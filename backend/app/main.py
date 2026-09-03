import logging
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.database.init_db import init_db
from app.database.models import ConversationMessage, Document, SessionSummary
from app.database.session import get_db
from app.ollama_client import ollama
from app.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    ModelsResponse,
    MetricsResponse,
    ChatMetrics
)
from app.services.chat_pipeline import chat_pipeline
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables on startup
    await init_db()
    await ollama.startup()
    yield
    await ollama.shutdown()

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.CORS_ORIGINS),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "running"
    }

@app.get("/health", response_model=HealthResponse)
async def health():
    try:
        online = await ollama.health()
    except Exception as e:
        logger.error(f"Ollama health check failed: {e}")
        online = False

    return HealthResponse(
        status="running",
        ollama="online" if online else "offline"
    )

@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    message = request.message.strip()
    session_id = request.session_id or str(uuid.uuid4())

    result = await chat_pipeline.chat(
        session_id=session_id,
        message=message,
        db=db,
        use_rag=request.use_rag,
        intent_override=request.intent_override,
        effort_level=request.effort_level,
    )

    return ChatResponse(
        success=True,
        session_id=session_id,
        intent=result.get("intent", "general"),
        model=result.get("model", "unknown"),
        latency_ms=result.get("latency_ms", 0.0),
        response=result.get("response", ""),
    )

@app.post("/chat/stream")
async def stream_chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    message = request.message.strip()
    session_id = request.session_id or str(uuid.uuid4())

    return StreamingResponse(
        chat_pipeline.stream_chat(
            session_id=session_id,
            message=message,
            db=db,
            use_rag=request.use_rag,
            intent_override=request.intent_override,
            effort_level=request.effort_level,
        ),
        media_type="text/plain"
    )

@app.get("/models", response_model=ModelsResponse)
async def get_models():
    try:
        models = await ollama.list_models()
    except Exception as e:
        logger.error(f"Ollama list_models failed: {e}")
        models = []

    return ModelsResponse(
        models=models
    )

@app.post("/conversations")
async def create_conversation():
    return {
        "conversation_id": str(uuid.uuid4())
    }

@app.get("/conversations")
async def get_conversations(db: AsyncSession = Depends(get_db)):
    # Fix N+1 query: use a single query with window function or subquery
    # Subquery to get the first user message content
    subq = (
        select(
            ConversationMessage.session_id,
            ConversationMessage.content,
            func.row_number().over(
                partition_by=ConversationMessage.session_id,
                order_by=ConversationMessage.created_at
            ).label("rn")
        )
        .where(ConversationMessage.role == "user")
        .subquery()
    )

    query = (
        select(
            ConversationMessage.session_id,
            func.max(ConversationMessage.created_at).label('updated_at'),
            func.max(subq.c.content).label('first_message')
        )
        .outerjoin(subq, (ConversationMessage.session_id == subq.c.session_id) & (subq.c.rn == 1))
        .group_by(ConversationMessage.session_id)
        .order_by(desc('updated_at'))
    )

    result = await db.execute(query)
    sessions = result.all()

    conversations = []
    for row in sessions:
        session_id = row.session_id
        updated_at = row.updated_at
        title = row.first_message

        display_title = "New Conversation"
        if title:
            display_title = title[:40] + "..." if len(title) > 40 else title
            
        conversations.append({
            "id": session_id,
            "title": display_title,
            "updatedAt": updated_at.isoformat() if updated_at else "",
            "createdAt": updated_at.isoformat() if updated_at else ""
        })
        
    return conversations

@app.delete("/conversations/{session_id}")
async def delete_conversation(session_id: str, db: AsyncSession = Depends(get_db)):
    docs = await rag_service.list_documents(db, session_id)
    for doc in docs:
        await rag_service.delete_document(db, str(doc.id))

    await db.execute(delete(SessionSummary).where(SessionSummary.session_id == session_id))
    await db.execute(delete(ConversationMessage).where(ConversationMessage.session_id == session_id))
    await db.commit()
    return {"success": True}

@app.get("/conversations/{session_id}/metrics", response_model=MetricsResponse)
async def get_conversation_metrics(session_id: str, db: AsyncSession = Depends(get_db)):
    from app.database.models import RequestLog
    query = select(
        func.count(RequestLog.id).label("total_requests"),
        func.avg(RequestLog.total_latency_ms).label("avg_latency"),
        func.sum(RequestLog.prompt_tokens).label("total_prompt_tokens"),
        func.sum(RequestLog.completion_tokens).label("total_completion_tokens"),
        func.avg(RequestLog.tokens_per_second).label("avg_tps")
    ).where(RequestLog.session_id == session_id)
    
    result = await db.execute(query)
    row = result.fetchone()
    
    if not row or row.total_requests == 0:
        return MetricsResponse(
            session_id=session_id,
            metrics=ChatMetrics(
                total_requests=0,
                average_latency_ms=0.0,
                total_prompt_tokens=0,
                total_completion_tokens=0,
                average_tokens_per_second=0.0
            )
        )
        
    return MetricsResponse(
        session_id=session_id,
        metrics=ChatMetrics(
            total_requests=row.total_requests or 0,
            average_latency_ms=float(row.avg_latency or 0.0),
            total_prompt_tokens=int(row.total_prompt_tokens or 0),
            total_completion_tokens=int(row.total_completion_tokens or 0),
            average_tokens_per_second=float(row.avg_tps or 0.0)
        )
    )

@app.get("/chat/{session_id}/messages")
async def get_chat_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    query = select(ConversationMessage).where(ConversationMessage.session_id == session_id).order_by(ConversationMessage.created_at)
    result = await db.execute(query)
    messages = result.scalars().all()
    
    return [
        {
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.created_at.isoformat() if msg.created_at else ""
        }
        for msg in messages
    ]

# Phase 3: Document Upload & RAG Endpoints
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Upload and ingest a document for RAG."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Save to temp file and read in chunks to prevent memory DoS
    bytes_read = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            bytes_read += len(chunk)
            if bytes_read > MAX_FILE_SIZE:
                Path(tmp.name).unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="File too large (max 50MB)")
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        doc = await rag_service.ingest_document(
            db=db,
            file_path=tmp_path,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            file_size=bytes_read,
            session_id=session_id,
        )
        return {
            "success": True,
            "document_id": str(doc.id),
            "filename": doc.filename,
            "chunks": doc.doc_metadata.get("total_chunks", 0) if doc.doc_metadata else 0,
        }
    finally:
        Path(tmp_path).unlink(missing_ok=True)

@app.get("/documents")
async def list_documents(
    session_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded documents."""
    docs = await rag_service.list_documents(db, session_id)
    return {
        "documents": [
            {
                "id": str(d.id),
                "filename": d.filename,
                "content_type": d.content_type,
                "file_size": d.file_size,
                "session_id": d.session_id,
                "metadata": d.doc_metadata,
                "created_at": d.created_at.isoformat() if d.created_at else "",
            }
            for d in docs
        ]
    }

@app.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and its chunks."""
    success = await rag_service.delete_document(db, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True, "message": "Document deleted"}

@app.patch("/documents/{document_id}/session")
async def reassign_document_session(
    document_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.session_id = session_id
    await db.commit()
    return {"success": True, "document_id": str(doc.id), "session_id": session_id}
