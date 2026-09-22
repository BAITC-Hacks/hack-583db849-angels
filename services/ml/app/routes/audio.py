"""F0 audio-boundary and synthetic speech routes."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, Depends, Response

from ..audio import resolve_audio_ref
from ..examples import ROOT, load_example
from ..schemas.contracts import SpeechRequest, TranscribeRequest, TranscribeResult


SILENT_MP3 = ROOT / "fixtures" / "audio" / "silence.mp3"


def audio_router(authenticate: Callable[..., None], uploads_dir: Path) -> APIRouter:
    router = APIRouter(prefix="/internal/v1", dependencies=[Depends(authenticate)])

    @router.post("/transcribe", response_model=TranscribeResult)
    async def transcribe(request: TranscribeRequest) -> TranscribeResult:
        resolve_audio_ref(request.audioRef, uploads_dir)
        return load_example("transcribe.response.json", TranscribeResult)

    @router.post(
        "/speech",
        response_class=Response,
        responses={200: {"content": {"audio/mpeg": {}}}},
    )
    async def speech(request: SpeechRequest) -> Response:
        del request
        return Response(content=SILENT_MP3.read_bytes(), media_type="audio/mpeg")

    return router
