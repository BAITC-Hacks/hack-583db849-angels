"""The candidate's own recorded answer — the surprise answer, the video presentation — as timed segments."""

from __future__ import annotations

from decimal import Decimal
import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.media import MediaGateway, MediaRequest
from ..schemas.contracts import TranscribedTurn, TranscribeRequest, TranscribeResult
from .transcription import _audio_content_type


class _ProviderModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class _Metadata(_ProviderModel):
    duration: float = Field(gt=0, allow_inf_nan=False)


class _Word(_ProviderModel):
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)


class _Utterance(_ProviderModel):
    transcript: str
    start: float = Field(ge=0, allow_inf_nan=False)
    end: float = Field(ge=0, allow_inf_nan=False)
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    words: list[_Word] = []


class _Results(_ProviderModel):
    # An answer can be silent: no utterance is a valid answer with nothing said.
    utterances: list[_Utterance] = []


class _DeepgramAnswer(_ProviderModel):
    metadata: _Metadata
    results: _Results


class AnswerTranscriptionService:
    """One speaker, the candidate, cut by Deepgram into utterances at the pauses.

    Each utterance becomes one segment the brief can quote, with its timecodes,
    so a quote lands on the moment in the video it came from.
    """

    def __init__(self, gateway: MediaGateway) -> None:
        self._gateway = gateway

    async def transcribe(self, request: TranscribeRequest, audio_path: Path) -> TranscribeResult:
        audio = audio_path.read_bytes()
        result = await self._gateway.execute(
            MediaRequest(
                task=TaskName.TRANSCRIPTION,
                operation="transcribe",
                content=audio,
                content_type=_audio_content_type(audio_path),
                parameters={
                    "language": request.language,
                    "speakers": request.speakers,
                    "purpose": request.purpose,
                },
                # A presentation runs at most three minutes; reserve five before a
                # live call. The provider's measured duration is what is billed.
                estimated_units=Decimal(5),
            )
        )
        if result.media_type != "application/json":
            raise GatewayOutputError("answer transcription output is invalid")
        try:
            provider = _DeepgramAnswer.model_validate(json.loads(result.content.decode("utf-8")))
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as error:
            raise GatewayOutputError("answer transcription output is invalid") from error
        return _map_segments(provider)


def _map_segments(provider: _DeepgramAnswer) -> TranscribeResult:
    turns = []
    previous_start = -1.0
    for item in provider.results.utterances:
        text = item.transcript.strip()
        if not text:
            continue
        if item.end <= item.start or item.end > provider.metadata.duration + 0.1 or item.start < previous_start:
            raise GatewayOutputError("answer transcription timing is invalid")
        previous_start = item.start
        confidence = min(word.confidence for word in item.words) if item.words else item.confidence
        turns.append(TranscribedTurn(
            speaker="candidate", text=text, startSec=item.start, endSec=item.end, confidence=confidence,
        ))
    return TranscribeResult(turns=turns, durationSec=provider.metadata.duration)
