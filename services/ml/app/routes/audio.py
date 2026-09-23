"""F0 audio-boundary and synthetic speech routes."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, Depends, Response

from ..audio import resolve_audio_ref
from ..examples import PACKAGE_ROOT, ROOT, load_example
from ..schemas.contracts import SpeechRequest, TranscribeRequest, TranscribeResult


ROOT_SILENT_MP3 = ROOT / "fixtures" / "audio" / "silence.mp3"
PACKAGED_SILENT_MP3 = PACKAGE_ROOT / "stub_data" / "silence.mp3"


def silent_mp3_path() -> Path:
    return ROOT_SILENT_MP3 if ROOT_SILENT_MP3.is_file() else PACKAGED_SILENT_MP3


def audio_router(authenticate: Callable[..., None], uploads_dir: Path) -> APIRouter:
    router = APIRouter(prefix="/internal/v1", dependencies=[Depends(authenticate)])

    @router.post(
        "/transcribe",
        response_model=TranscribeResult,
        response_model_exclude_none=True,
    )
    async def transcribe(request: TranscribeRequest) -> TranscribeResult:
        resolve_audio_ref(request.audioRef, uploads_dir)
        example = (
            "transcribe-turn.response.json"
            if request.purpose == "turn" and request.speakers == 1
            else "transcribe.response.json"
        )
        return load_example(example, TranscribeResult)

    @router.post(
        "/speech",
        response_class=Response,
        responses={200: {"content": {"audio/mpeg": {}}}},
    )
    async def speech(request: SpeechRequest) -> Response:
        del request
        return Response(content=silent_mp3_path().read_bytes(), media_type="audio/mpeg")

    return router
