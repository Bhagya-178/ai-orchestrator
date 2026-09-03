"""
Phase 3: RAG Service

Handles document ingestion (PDF, DOCX, TXT), embedding generation via Ollama,
vector storage in Qdrant, and retrieval for chat augmentation.
"""

import asyncio
import logging
import uuid
from pathlib import Path

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qdrant_models
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.models import Document, DocumentChunk
from app.ollama_client import ollama
from app.services.document_parser import chunk_text, parse_document

logger = logging.getLogger(__name__)

EMBEDDING_BATCH_CONCURRENCY = 5

class RAGService:
    """RAG pipeline: parse -> chunk -> embed -> store -> retrieve."""

    def __init__(self) -> None:
        self.client: AsyncQdrantClient | None = None
        self.collection_name = settings.QDRANT_COLLECTION
        self._initialized = False
        self._available = False

    @property
    def is_available(self) -> bool:
        """Whether Qdrant is reachable and the collection is ready."""
        return self._available

    # ------------------------------------------------------------------
    # Qdrant initialisation  (lazy, async)
    # ------------------------------------------------------------------
    async def _init_client(self, required: bool = False) -> None:
        """Lazy-connect to Qdrant.

        Args:
            required: If True raise on failure (write ops like ingest/delete).
                      If False silently disable RAG (read ops like search).
        """
        if self._initialized:
            return
        try:
            self.client = AsyncQdrantClient(url=settings.QDRANT_URL)
            await self._ensure_collection()
            self._initialized = True
            self._available = True
            logger.info("Connected to Qdrant at %s", settings.QDRANT_URL)
        except Exception:
            self._available = False
            self._initialized = False
            self.client = None
            if required:
                logger.exception("Qdrant unreachable at %s", settings.QDRANT_URL)
                raise RuntimeError(
                    f"Qdrant is not reachable at {settings.QDRANT_URL}. "
                    "Please start Qdrant before uploading documents."
                )
            logger.warning(
                "Qdrant not reachable at %s — RAG features disabled.", settings.QDRANT_URL
            )

    async def _ensure_collection(self) -> None:
        """Create collection if it doesn't exist."""
        if not self.client:
            return
        try:
            collections = await self.client.get_collections()
            if not any(c.name == self.collection_name for c in collections.collections):
                await self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qdrant_models.VectorParams(
                        size=1024,  # bge-m3 embedding dimension
                        distance=qdrant_models.Distance.COSINE,
                    ),
                )
                logger.info("Created Qdrant collection '%s'", self.collection_name)
        except Exception:
            logger.exception(
                "Failed to ensure Qdrant collection '%s'", self.collection_name
            )
            raise

    # ------------------------------------------------------------------
    # Embeddings  (concurrent batching)
    # ------------------------------------------------------------------
    async def get_embedding(self, text: str) -> list[float]:
        """Generate embedding using Ollama embedding model."""
        try:
            response = await ollama.embeddings(
                model=settings.EMBEDDING_MODEL,
                prompt=text,
            )
            embedding = response.get("embedding", [])
            if not embedding:
                logger.warning("Empty embedding returned (text len=%d)", len(text))
                raise ValueError("Empty embedding returned from Ollama")
            return embedding
        except Exception as e:
            logger.exception("Failed to generate embedding (text len=%d)", len(text))
            raise ValueError(f"Failed to generate embedding: {e}")

    async def get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings concurrently with bounded parallelism."""
        semaphore = asyncio.Semaphore(EMBEDDING_BATCH_CONCURRENCY)

        async def _embed(text: str) -> list[float]:
            async with semaphore:
                try:
                    return await self.get_embedding(text)
                except ValueError:
                    return []  # Keep returning empty for partial failure, handled in ingest_document

        return await asyncio.gather(*[_embed(t) for t in texts])

    # ------------------------------------------------------------------
    # Ingestion Pipeline
    # ------------------------------------------------------------------
    async def ingest_document(
        self,
        db: AsyncSession,
        file_path: str,
        filename: str,
        content_type: str,
        file_size: int,
        session_id: str | None = None,
    ) -> Document:
        """Full ingestion: parse -> chunk -> embed -> store in Qdrant + Postgres."""
        # 1. Parse document
        try:
            parsed_chunks = await parse_document(file_path, content_type)
        except ValueError as e:
            raise e
        except Exception:
            logger.exception("Failed to parse document: %s", file_path)
            raise ValueError(f"Error reading file '{Path(file_path).name}'")

        if not parsed_chunks:
            raise ValueError(f"No content could be extracted from '{filename}'")

        # 2. Create Document record
        doc = Document(
            filename=filename,
            content_type=content_type,
            file_size=file_size,
            session_id=session_id,
            doc_metadata={"total_chunks": len(parsed_chunks)},
        )
        db.add(doc)
        await db.flush()  # get doc.id

        # 3. Process each parsed section
        all_chunks = []
        for section in parsed_chunks:
            text_chunks = chunk_text(section["content"])
            for idx, chunk_content in enumerate(text_chunks):
                all_chunks.append({
                    "content": chunk_content,
                    "chunk_index": len(all_chunks),
                    "page_num": section.get("page_num", 1),
                    "metadata": {**section.get("metadata", {}), "chunk_idx": idx},
                })

        # Update metadata with actual chunk count after splitting.
        doc.doc_metadata = {"total_chunks": len(all_chunks)}

        # 4. Generate embeddings (concurrent)
        embeddings = await self.get_embeddings_batch(
            [c["content"] for c in all_chunks]
        )

        # 5. Store in Qdrant + Postgres
        await self._init_client(required=True)
        if not self.client:
            raise RuntimeError("Qdrant client not initialized")

        points = []
        for chunk_data, embedding in zip(all_chunks, embeddings):
            if not embedding:
                logger.warning(
                    "Skipping chunk %d — empty embedding", chunk_data["chunk_index"]
                )
                continue

            point_id = str(uuid.uuid4())

            points.append(qdrant_models.PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "document_id": str(doc.id),
                    "content": chunk_data["content"],
                    "chunk_index": chunk_data["chunk_index"],
                    "page_num": chunk_data["page_num"],
                    "metadata": chunk_data["metadata"],
                },
            ))

            db.add(DocumentChunk(
                document_id=doc.id,
                chunk_index=chunk_data["chunk_index"],
                content=chunk_data["content"],
                qdrant_point_id=point_id,
                chunk_metadata=chunk_data["metadata"],
            ))

        if not points and all_chunks:
            # If we had chunks but couldn't generate ANY embeddings, fail the upload.
            logger.error("Failed to generate embeddings for all %d chunks.", len(all_chunks))
            raise ValueError(f"Failed to generate embeddings for document. Is the embedding model '{settings.EMBEDDING_MODEL}' pulled in Ollama?")

        # Batch upsert to Qdrant
        if points:
            try:
                await self.client.upsert(
                    collection_name=self.collection_name,
                    points=points,
                )
            except Exception:
                logger.exception("Qdrant upsert failed for document %s", doc.id)
                raise

        await db.commit()
        await db.refresh(doc)
        logger.info(
            "Ingested '%s': %d chunks, %d points stored",
            filename, len(all_chunks), len(points),
        )
        return doc

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------
    async def search(
        self,
        query: str,
        limit: int = 5,
        score_threshold: float = 0.7,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        """Search for relevant chunks. Returns [] if Qdrant is unavailable."""
        await self._init_client(required=False)
        if not self._available or not self.client:
            return []

        try:
            query_embedding = await self.get_embedding(query)
        except ValueError:
            logger.warning("Empty query embedding — returning no results")
            return []

        # Build filter if document_ids provided
        query_filter = None
        if document_ids:
            query_filter = qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="document_id",
                        match=qdrant_models.MatchAny(any=document_ids),
                    )
                ]
            )

        try:
            if hasattr(self.client, "query_points"):
                response = await self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_embedding,
                    limit=limit,
                    score_threshold=score_threshold,
                    query_filter=query_filter,
                    with_payload=True,
                )
                results = response.points
            else:
                results = await self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_embedding,
                    limit=limit,
                    score_threshold=score_threshold,
                    query_filter=query_filter,
                    with_payload=True,
                )
        except Exception:
            logger.exception("Qdrant search failed")
            return []

        return [
            {
                "content": hit.payload["content"],
                "score": hit.score,
                "document_id": hit.payload["document_id"],
                "chunk_index": hit.payload["chunk_index"],
                "page_num": hit.payload.get("page_num"),
                "metadata": hit.payload.get("metadata", {}),
            }
            for hit in results
        ]

    async def get_raw_chunks(self, db: AsyncSession, document_ids: list[str], limit: int = 5) -> list[dict]:
        """Directly fetch the first few chunks from Postgres as a fallback when search fails."""
        if not document_ids:
            return []
        
        import uuid
        uuid_ids = [uuid.UUID(str(d)) for d in document_ids]
        query = (
            select(DocumentChunk)
            .where(DocumentChunk.document_id.in_(uuid_ids))
            .order_by(DocumentChunk.document_id, DocumentChunk.chunk_index)
            .limit(limit)
        )
        
        result = await db.execute(query)
        chunks = result.scalars().all()
        
        return [
            {
                "content": c.content,
                "score": 0.0,
                "document_id": str(c.document_id),
                "chunk_index": c.chunk_index,
                "page_num": c.chunk_metadata.get("page", 1) if c.chunk_metadata else 1,
                "metadata": c.chunk_metadata or {},
            }
            for c in chunks
        ]

    # ------------------------------------------------------------------
    # Document Management
    # ------------------------------------------------------------------
    async def list_documents(
        self, db: AsyncSession, session_id: str | None = None
    ) -> list[Document]:
        """List all documents, optionally filtered by session."""
        query = select(Document)
        if session_id:
            query = query.where(Document.session_id == session_id)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def delete_document(self, db: AsyncSession, document_id: str) -> bool:
        """Delete document and its chunks from both stores."""
        await self._init_client(required=True)

        # Delete from Qdrant
        if self.client:
            try:
                await self.client.delete(
                    collection_name=self.collection_name,
                    points_selector=qdrant_models.FilterSelector(
                        filter=qdrant_models.Filter(
                            must=[
                                qdrant_models.FieldCondition(
                                    key="document_id",
                                    match=qdrant_models.MatchValue(value=document_id),
                                )
                            ]
                        )
                    ),
                )
            except Exception:
                logger.exception("Qdrant delete failed for document %s", document_id)
                # Continue to Postgres cleanup even if Qdrant fails.

        # Delete from Postgres (cascades to chunks)
        try:
            doc_uuid = uuid.UUID(document_id)
            # Delete chunks first to avoid foreign key constraint violation
            await db.execute(
                delete(DocumentChunk).where(DocumentChunk.document_id == doc_uuid)
            )
            result = await db.execute(
                select(Document).where(Document.id == doc_uuid)
            )
            doc = result.scalars().first()
            if doc:
                await db.delete(doc)
                await db.commit()
                return True
            # If doc not found but chunks deleted, we still commit
            await db.commit()
            return False
        except ValueError:
            # Invalid UUID
            return False
        except Exception as e:
            logger.error("Failed to delete document from Postgres: %s", e)
            await db.rollback()
            return False


rag_service = RAGService()