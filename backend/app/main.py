from fastapi import FastAPI, Request
import traceback
from app.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    ModelsResponse,
)
from fastapi.responses import StreamingResponse

from app.config import APP_NAME
from app.schemas import (
    ChatRequest,
    HealthResponse,
    ModelsResponse,
)

from app.services.chat_pipeline import chat_pipeline
from app.ollama_client import ollama
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db



import uuid



app = FastAPI(title=APP_NAME)


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

    online = await ollama.health()

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

    # Use the client's session_id when provided so a conversation can be
    # resumed across requests; otherwise start a new one.
    request_session_id = request.session_id or str(uuid.uuid4())

    result = await chat_pipeline.chat(
        session_id=request_session_id,
        message=message,
        db=db,
    )

    return ChatResponse(
        success=True,
        session_id=request_session_id,
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

    request_session_id = request.session_id or str(uuid.uuid4())

    return StreamingResponse(
        chat_pipeline.stream_chat(
            session_id=request_session_id,
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

    models = await ollama.list_models()

    return ModelsResponse(
        models=models
    )
    
    
@app.post("/conversations")
async def create_conversation():
    return {
        "conversation_id": str(uuid.uuid4())
    }