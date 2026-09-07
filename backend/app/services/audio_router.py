"""
API Router for Speech-to-Text Audio Transcription and Text-to-Speech Voice Synthesis.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.auth.dependencies import get_optional_user
from app.database.models import User
from app.services.audio_service import audio_service

router = APIRouter(prefix="/audio", tags=["Voice & Audio"])


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: str = "default"
    speed: float = 1.0


@router.post("/transcribe")
async def transcribe_audio_file(
    file: UploadFile = File(...),
    current_user: User | None = Depends(get_optional_user),
):
    """Transcribe uploaded spoken voice audio into text."""
    audio_content = await file.read()
    if not audio_content:
        raise HTTPException(status_code=400, detail="Empty audio file provided.")

    try:
        return await audio_service.transcribe_audio(audio_content, filename=file.filename or "recording.wav")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(ex)}")


@router.post("/synthesize")
async def synthesize_speech_stream(
    body: SynthesizeRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """Synthesize text into speech audio bytes (WAV)."""
    try:
        wav_bytes = await audio_service.synthesize_speech(text=body.text, voice=body.voice, speed=body.speed)
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(ex)}")
