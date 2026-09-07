from __future__ import annotations

import logging
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, desc, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.database.init_db import init_db
from app.database.models import ConversationMessage, Document, SessionSummary, Conversation, User
from app.database.session import get_db
from app.ollama_client import ollama
from app.auth.router import router as auth_router
from app.tools.router import router as tools_router
from app.mcp.router import router as mcp_router
from app.services.rag_v2.router import router as rag_v2_router
from app.prompts.router import router as prompts_router
from app.services.arena_router import router as arena_router
from app.workspaces.router import router as workspaces_router
from app.analytics.router import router as analytics_router
from app.services.audio_router import router as audio_router
from app.auth.api_keys_router import router as api_keys_router
from app.services.webhooks_router import router as webhooks_router
from app.agents.router import router as agents_router
from app.services.rag_v2.graph_router import router as graph_router
from app.services.evals_router import router as evals_router
from app.auth.dependencies import get_current_user, get_optional_user
from app.services.export_service import export_service
from app.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    ModelsResponse,
    MetricsResponse,
    ChatMetrics,
    ConversationResponse,
    ConversationUpdateRequest,
    ConversationExportResponse,
    RegenerateRequest,
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

app.include_router(auth_router)
app.include_router(tools_router)
app.include_router(mcp_router)
app.include_router(rag_v2_router)
app.include_router(prompts_router)
app.include_router(arena_router)
app.include_router(workspaces_router)
app.include_router(analytics_router)
app.include_router(audio_router)
app.include_router(api_keys_router)
app.include_router(webhooks_router)
app.include_router(agents_router)
app.include_router(graph_router)
app.include_router(evals_router)

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
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    message = request.message.strip()
    session_id = request.session_id or str(uuid.uuid4())

    # Resolve and persist conversation settings
    intent_override = request.intent_override
    effort_level = request.effort_level

    custom_system_prompt = ""

    try:
        conv = await db.get(Conversation, session_id)
        if not conv:
            conv = Conversation(
                id=session_id,
                user_id=current_user.id if current_user else None,
                title=message[:40] + "..." if len(message) > 40 else message,
                intent_override=intent_override or "auto",
                effort_level=effort_level or "medium",
            )
            db.add(conv)
            await db.commit()
        else:
            changed = False
            if current_user and not conv.user_id:
                conv.user_id = current_user.id
                changed = True

            # If title is default 'New Conversation' or empty, derive from real user prompt
            if not conv.title or conv.title.strip() in ("New Conversation", "New Chat", ""):
                conv.title = message[:40] + "..." if len(message) > 40 else message
                changed = True

            if intent_override is not None and intent_override != conv.intent_override:
                conv.intent_override = intent_override
                changed = True
            elif intent_override is None:
                intent_override = conv.intent_override

            if effort_level is not None and effort_level != conv.effort_level:
                conv.effort_level = effort_level
                changed = True
            elif effort_level is None:
                effort_level = conv.effort_level

            if changed:
                await db.commit()

        if conv.system_prompt:
            custom_system_prompt = conv.system_prompt.strip()

    except Exception as e:
        logger.warning("Failed to upsert conversation settings in stream_chat: %s", e)

    # Incorporate user-level custom instructions if available
    if current_user and current_user.custom_instructions:
        user_inst = current_user.custom_instructions.strip()
        custom_system_prompt = f"{user_inst}\n\n{custom_system_prompt}".strip() if custom_system_prompt else user_inst

    return StreamingResponse(
        chat_pipeline.stream_chat(
            session_id=session_id,
            message=message,
            db=db,
            use_rag=request.use_rag,
            intent_override=intent_override,
            effort_level=effort_level,
            custom_system_prompt=custom_system_prompt,
        ),
        media_type="text/plain"
    )

@app.post("/chat/regenerate")
async def regenerate_chat(
    request: RegenerateRequest,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate response from the last user message (ChatGPT/Claude Retry)."""
    session_id = request.session_id
    conv = await db.get(Conversation, session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Find the last user message
    user_msgs_res = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session_id, ConversationMessage.role == "user")
        .order_by(desc(ConversationMessage.created_at))
        .limit(1)
    )
    last_user_msg = user_msgs_res.scalar_one_or_none()
    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found to regenerate")

    # Delete any trailing assistant messages from this turn
    delete_stmt = delete(ConversationMessage).where(
        ConversationMessage.session_id == session_id,
        ConversationMessage.role == "assistant",
    )
    if last_user_msg.created_at is not None:
        delete_stmt = delete_stmt.where(ConversationMessage.created_at >= last_user_msg.created_at)
    elif getattr(last_user_msg, "id", None) is not None:
        delete_stmt = delete_stmt.where(ConversationMessage.id >= last_user_msg.id)
    await db.execute(delete_stmt)
    await db.commit()

    intent_override = request.intent_override or conv.intent_override
    effort_level = request.effort_level or conv.effort_level

    custom_system_prompt = conv.system_prompt or ""
    if current_user and current_user.custom_instructions:
        user_inst = current_user.custom_instructions.strip()
        custom_system_prompt = f"{user_inst}\n\n{custom_system_prompt}".strip() if custom_system_prompt else user_inst

    return StreamingResponse(
        chat_pipeline.stream_chat(
            session_id=session_id,
            message=last_user_msg.content,
            db=db,
            use_rag=request.use_rag,
            intent_override=intent_override,
            effort_level=effort_level,
            custom_system_prompt=custom_system_prompt,
        ),
        media_type="text/plain",
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
async def create_conversation(
    body: dict[str, Any] | None = None,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    conv_id = str(uuid.uuid4())
    title = (body.get("title") if body else None) or "New Conversation"
    conv = Conversation(
        id=conv_id,
        user_id=current_user.id if current_user else None,
        title=title,
        intent_override="auto",
        effort_level="medium",
    )
    db.add(conv)
    await db.commit()
    return {
        "conversation_id": conv_id,
        "title": title,
    }

@app.get("/conversations", response_model=list[ConversationResponse])
async def get_conversations(
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    # Subquery to get the first user message content for titles
    subq = (
        select(
            ConversationMessage.session_id,
            ConversationMessage.content,
            func.row_number().over(
                partition_by=ConversationMessage.session_id,
                order_by=(ConversationMessage.created_at.asc().nulls_last(), ConversationMessage.id.asc())
            ).label("rn")
        )
        .where(ConversationMessage.role == "user", func.trim(ConversationMessage.content) != "")
        .subquery()
    )

    query = (
        select(
            Conversation.id.label("session_id"),
            func.coalesce(func.max(ConversationMessage.created_at), Conversation.updated_at).label('updated_at'),
            Conversation.created_at.label('created_at'),
            case(
                (
                    (Conversation.title.is_(None)) | (Conversation.title.in_(["New Conversation", "New Chat", ""])),
                    func.coalesce(func.max(subq.c.content), Conversation.title, "New Conversation")
                ),
                else_=Conversation.title
            ).label('title'),
            Conversation.intent_override,
            Conversation.effort_level,
            Conversation.is_pinned,
            Conversation.system_prompt,
        )
        .outerjoin(ConversationMessage, Conversation.id == ConversationMessage.session_id)
        .outerjoin(subq, (Conversation.id == subq.c.session_id) & (subq.c.rn == 1))
    )

    # Strict user-level data isolation: authenticated users see only their own conversations;
    # unauthenticated guests see only unassigned guest sessions.
    if current_user:
        query = query.where(Conversation.user_id == current_user.id)
    else:
        query = query.where(Conversation.user_id.is_(None))

    query = (
        query.group_by(
            Conversation.id,
            Conversation.updated_at,
            Conversation.created_at,
            Conversation.title,
            Conversation.intent_override,
            Conversation.effort_level,
            Conversation.is_pinned,
            Conversation.system_prompt,
        )
        .order_by(desc(Conversation.is_pinned), desc('updated_at'))
    )

    result = await db.execute(query)
    sessions = result.all()

    conversations = []
    for row in sessions:
        title = row.title
        display_title = "New Conversation"
        if title:
            display_title = title[:50] + "..." if len(title) > 50 else title

        conversations.append(ConversationResponse(
            id=row.session_id,
            title=display_title,
            updatedAt=row.updated_at.isoformat() if row.updated_at else "",
            createdAt=row.created_at.isoformat() if row.created_at else "",
            intent_override=row.intent_override or "auto",
            effort_level=row.effort_level or "medium",
            is_pinned=bool(row.is_pinned),
            system_prompt=row.system_prompt or "",
        ))

    return conversations

@app.get("/conversations/{session_id}", response_model=ConversationResponse)
async def get_conversation(
    session_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, session_id)
    if conv and conv.user_id and current_user and conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied to this conversation")

    first_msg_query = (
        select(ConversationMessage.content)
        .where(ConversationMessage.session_id == session_id, ConversationMessage.role == "user", func.trim(ConversationMessage.content) != "")
        .order_by(ConversationMessage.created_at.asc().nulls_last(), ConversationMessage.id.asc())
        .limit(1)
    )
    res = await db.execute(first_msg_query)
    first_msg = res.scalar_one_or_none()

    if conv and conv.title and conv.title.strip() not in ("New Conversation", "New Chat", ""):
        display_title = conv.title
    elif first_msg:
        display_title = first_msg[:50] + "..." if len(first_msg) > 50 else first_msg
    else:
        display_title = "New Conversation"

    return ConversationResponse(
        id=session_id,
        title=display_title,
        updatedAt=conv.updated_at.isoformat() if conv and conv.updated_at else "",
        createdAt=conv.created_at.isoformat() if conv and conv.created_at else "",
        intent_override=conv.intent_override if conv else "auto",
        effort_level=conv.effort_level if conv else "medium",
        is_pinned=bool(conv.is_pinned) if conv else False,
        system_prompt=conv.system_prompt or "" if conv else "",
    )

@app.patch("/conversations/{session_id}", response_model=ConversationResponse)
async def update_conversation_settings(
    session_id: str,
    body: ConversationUpdateRequest,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, session_id)
    if conv and conv.user_id and current_user and conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied to this conversation")

    if not conv:
        conv = Conversation(
            id=session_id,
            user_id=current_user.id if current_user else None,
            intent_override=body.intent_override or "auto",
            effort_level=body.effort_level or "medium",
            title=body.title or "New Conversation",
            is_pinned=body.is_pinned if body.is_pinned is not None else False,
            system_prompt=body.system_prompt or "",
        )
        db.add(conv)
    else:
        if body.intent_override is not None:
            conv.intent_override = body.intent_override
        if body.effort_level is not None:
            conv.effort_level = body.effort_level
        if body.title is not None:
            conv.title = body.title
        if body.is_pinned is not None:
            conv.is_pinned = body.is_pinned
        if body.system_prompt is not None:
            conv.system_prompt = body.system_prompt

    await db.commit()
    await db.refresh(conv)

    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        updatedAt=conv.updated_at.isoformat() if conv.updated_at else "",
        createdAt=conv.created_at.isoformat() if conv.created_at else "",
        intent_override=conv.intent_override or "auto",
        effort_level=conv.effort_level or "medium",
        is_pinned=bool(conv.is_pinned),
        system_prompt=conv.system_prompt or "",
    )

@app.get("/conversations/{session_id}/export", response_model=ConversationExportResponse)
async def export_conversation(
    session_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a conversation to Markdown and JSON (ChatGPT/Claude Export)."""
    conv = await db.get(Conversation, session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.user_id and current_user and conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied to this conversation")

    messages_query = (
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.created_at)
    )
    res = await db.execute(messages_query)
    messages = res.scalars().all()

    md = export_service.to_markdown(conv, list(messages))
    json_data = export_service.to_json_dict(conv, list(messages))

    return ConversationExportResponse(
        id=conv.id,
        title=conv.title,
        markdown=md,
        json_data=json_data,
    )

@app.delete("/conversations/{session_id}")
async def delete_conversation(
    session_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.user_id and current_user and conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied to this conversation")

    docs = await rag_service.list_documents(db, session_id)
    for doc in docs:
        await rag_service.delete_document(db, str(doc.id))

    await db.execute(delete(SessionSummary).where(SessionSummary.session_id == session_id))
    await db.execute(delete(ConversationMessage).where(ConversationMessage.session_id == session_id))
    await db.execute(delete(Conversation).where(Conversation.id == session_id))
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
async def get_chat_messages(
    session_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, session_id)
    if conv and conv.user_id and current_user and conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied to this conversation")

    query = select(ConversationMessage).where(ConversationMessage.session_id == session_id).order_by(ConversationMessage.created_at)
    result = await db.execute(query)
    messages = result.scalars().all()

    # Retrieve any document uploaded for this conversation session
    docs = await rag_service.list_documents(db, session_id)
    doc_attachment = None
    if docs:
        d = docs[0]
        doc_attachment = {
            "id": str(d.id),
            "filename": d.filename,
            "fileSize": d.file_size,
            "contentType": d.content_type,
            "status": "ready"
        }

    response_messages = []
    attached_set = False
    for msg in messages:
        msg_dict = {
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.created_at.isoformat() if msg.created_at else ""
        }
        if doc_attachment and msg.role == "user" and not attached_set:
            msg_dict["attachedDocument"] = doc_attachment
            attached_set = True
        response_messages.append(msg_dict)

    return response_messages

@app.get("/chat/recent-prompts")
async def get_recent_prompts(db: AsyncSession = Depends(get_db)):
    query = (
        select(ConversationMessage.content)
        .where(ConversationMessage.role == "user")
        .order_by(desc(ConversationMessage.created_at))
        .limit(30)
    )
    result = await db.execute(query)
    prompts = result.scalars().all()
    seen = set()
    unique_prompts = []
    for p in prompts:
        cleaned = p.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique_prompts.append(cleaned)
    return list(reversed(unique_prompts))

# Phase 3: Document Upload & RAG Endpoints
ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".txt", ".md",
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".json", ".csv", ".sql", ".html", ".css",
    ".yaml", ".yml", ".sh", ".bash", ".xml",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str | None = None,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and ingest a document for RAG."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
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
        if current_user:
            doc.user_id = current_user.id
            await db.commit()

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
    try:
        doc_uuid = uuid.UUID(str(document_id))
        result = await db.execute(select(Document).where(Document.id == doc_uuid))
    except (ValueError, AttributeError):
        result = await db.execute(select(Document).where(Document.id == document_id))

    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.session_id = session_id
    await db.commit()
    return {"success": True, "document_id": str(doc.id), "session_id": session_id}
