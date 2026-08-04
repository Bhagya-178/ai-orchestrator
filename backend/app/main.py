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

from app.services.chat_service import chat_service
from app.ollama_client import ollama
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db



import uuid
session_id = str(uuid.uuid4())



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

    result = await chat_service.chat(
        session_id=str(uuid.uuid4()),
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
async def stream_chat(request: ChatRequest):

    message = request.message.strip()

    return StreamingResponse(
        chat_service.stream_chat(
            session_id=str(uuid.uuid4()),
            message=message
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