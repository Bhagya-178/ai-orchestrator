from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import traceback
import shutil
import tempfile
from pathlib import Path

from app.database.init_db import init_db
from app.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    ModelsResponse,
)
from fastapi.responses import StreamingResponse

from app.config import APP_NAME

from app.services.chat_pipeline import chat_pipeline
from app.services.rag_service import rag_service
from app.ollama_client import ollama
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.database.models import Document

import uuid


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables on startup
    await init_db()
    yield


app = FastAPI(title=APP_NAME, lifespan=lifespan)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
async def root():
    return {
        "status": "running"
    }


@app.get(
    "/health",
    response_model=HealthResponse
)
async def health():
    try:
        online = await ollama.health()
    except Exception as e:
        print(f"Ollama health check failed: {e}")
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
    )

    return ChatResponse(
        success=True,
        session_id=session_id,
        intent=result["intent"],
        model=result["model"],
        latency_ms=result["latency_ms"],
        response=result["response"],
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
        ),
        media_type="text/plain"
    )

@app.get(
    "/models",
    response_model=ModelsResponse
)
async def get_models():
    try:
        models = await ollama.list_models()
    except Exception as e:
        print(f"Ollama list_models failed: {e}")
        models = []

    return ModelsResponse(
        models=models
    )


from sqlalchemy.future import select

@app.post("/conversations")
async def create_conversation():
    return {
        "conversation_id": str(uuid.uuid4())
    }

@app.get("/conversations")
async def get_conversations(db: AsyncSession = Depends(get_db)):
    # Group messages by session_id to get distinct conversations
    from app.database.models import ConversationMessage
    from sqlalchemy import func, desc
    
    # Get distinct session_ids, their latest message time, and the first user message as title
    query = select(
        ConversationMessage.session_id,
        func.max(ConversationMessage.created_at).label('updated_at')
    ).group_by(ConversationMessage.session_id).order_by(desc('updated_at'))
    
    result = await db.execute(query)
    sessions = result.all()
    
    conversations = []
    for session_id, updated_at in sessions:
        # Get first user message for title
        title_query = select(ConversationMessage.content).where(
            ConversationMessage.session_id == session_id,
            ConversationMessage.role == "user"
        ).order_by(ConversationMessage.created_at).limit(1)
        
        title_res = await db.execute(title_query)
        title = title_res.scalar_one_or_none()
        
        # Format title
        display_title = "New Conversation"
        if title:
            display_title = title[:40] + "..." if len(title) > 40 else title
            
        conversations.append({
            "id": session_id,
            "title": display_title,
            "updatedAt": updated_at.isoformat(),
            "createdAt": updated_at.isoformat()
        })
        
    return conversations

@app.delete("/conversations/{session_id}")
async def delete_conversation(session_id: str, db: AsyncSession = Depends(get_db)):
    from app.database.models import ConversationMessage, Document
    from sqlalchemy import delete
    
    # First, list all documents for this session and delete them via rag_service 
    # (this ensures Qdrant is also cleaned up)
    docs = await rag_service.list_documents(db, session_id)
    for doc in docs:
        await rag_service.delete_document(db, str(doc.id))

    # Then delete all messages
    await db.execute(delete(ConversationMessage).where(ConversationMessage.session_id == session_id))
    await db.commit()
    return {"success": True}

@app.get("/chat/{session_id}/messages")
async def get_chat_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    from app.database.models import ConversationMessage
    query = select(ConversationMessage).where(ConversationMessage.session_id == session_id).order_by(ConversationMessage.created_at)
    result = await db.execute(query)
    messages = result.scalars().all()
    
    return [
        {
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.created_at.isoformat()
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

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Ingest document
        doc = await rag_service.ingest_document(
            db=db,
            file_path=tmp_path,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            file_size=len(content),
            session_id=session_id,
        )
        return {
            "success": True,
            "document_id": str(doc.id),
            "filename": doc.filename,
            "chunks": doc.doc_metadata.get("total_chunks", 0),
        }
    finally:
        # Cleanup temp file
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
                "created_at": d.created_at.isoformat(),
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
