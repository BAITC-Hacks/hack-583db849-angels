"""F0 audio-boundary and synthetic speech routes."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, Depends, Response

from ..audio import resolve_audio_ref
from ..errors import ServiceError
from ..examples import load_example
from ..modules.interview_transcription import InterviewTranscriptionService
from ..modules.speech import SpeechService
from ..modules.transcription import TurnTranscriptionService
from ..schemas.contracts import SpeechRequest, TranscribeRequest, TranscribeResult


def audio_router(
    authenticate: Callable[..., None],
    uploads_dir: Path,
    turn_transcription: TurnTranscriptionService,
    interview_transcription: InterviewTranscriptionService,
    speech_service: SpeechService,
) -> APIRouter:
    router = APIRouter(prefix="/internal/v1", dependencies=[Depends(authenticate)])

    @router.post(
        "/transcribe",
        response_model=TranscribeResult,
        response_model_exclude_none=True,
    )
    async def transcribe(request: TranscribeRequest) -> TranscribeResult:
        if request.purpose == "interview" and request.speakers != 2:
            raise ServiceError(status_code=422, code="VALIDATION_ERROR", message="Request validation failed.")
        if request.purpose in {"turn", "surprise"} and request.speakers != 1:
            raise ServiceError(status_code=422, code="VALIDATION_ERROR", message="Request validation failed.")
        audio_path = resolve_audio_ref(request.audioRef, uploads_dir)
        if request.purpose in {"turn", "surprise"} and request.speakers == 1:
            return await turn_transcription.transcribe(request, audio_path)
        if request.purpose == "interview":
            return await interview_transcription.transcribe(request, audio_path)
        return load_example("transcribe.response.json", TranscribeResult)

    @router.post(
        "/speech",
        response_class=Response,
        responses={200: {"content": {"audio/mpeg": {}}}},
    )
    async def speech(request: SpeechRequest) -> Response:
        audio = await speech_service.synthesize(request)
        return Response(content=audio, media_type="audio/mpeg")

    return router
