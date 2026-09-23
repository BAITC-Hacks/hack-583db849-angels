"""One-speaker simulation turn transcription through the media gateway."""

from __future__ import annotations

from decimal import Decimal
import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.media import MediaGateway, MediaRequest
from ..schemas.contracts import TranscribedTurn, TranscribeRequest, TranscribeResult


class _ProviderModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class _Word(_ProviderModel):
    word: str
    punctuated_word: str | None = None
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    confidence: float = Field(ge=0, le=1)


class _Alternative(_ProviderModel):
    transcript: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    words: list[_Word] = []


class _Channel(_ProviderModel):
    alternatives: list[_Alternative] = Field(min_length=1)


class _Results(_ProviderModel):
    channels: list[_Channel] = Field(min_length=1)


class _Metadata(_ProviderModel):
    duration: float = Field(ge=0)


class _DeepgramTranscript(_ProviderModel):
    metadata: _Metadata
    results: _Results


class TurnTranscriptionService:
    def __init__(self, gateway: MediaGateway) -> None:
        self._gateway = gateway

    async def transcribe(
        self, request: TranscribeRequest, audio_path: Path
    ) -> TranscribeResult:
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
                # API accepts at most 60 seconds for an M2 turn. Reserving one full
                # minute keeps the pre-call budget conservative without decoding.
                estimated_units=Decimal(1),
            )
        )
        try:
            provider = _DeepgramTranscript.model_validate(
                json.loads(result.content.decode("utf-8"))
            )
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as error:
            raise GatewayOutputError("transcription output is invalid") from error

        alternative = provider.results.channels[0].alternatives[0]
        text = alternative.transcript.strip()
        if not text:
            return TranscribeResult(turns=[], durationSec=provider.metadata.duration)

        start = alternative.words[0].start if alternative.words else 0.0
        end = (
            alternative.words[-1].end
            if alternative.words
            else provider.metadata.duration
        )
        confidences = [word.confidence for word in alternative.words]
        confidence = min(confidences) if confidences else alternative.confidence
        return TranscribeResult(
            turns=[
                TranscribedTurn(
                    speaker="candidate",
                    text=text,
                    startSec=start,
                    endSec=end,
                    confidence=confidence,
                )
            ],
            durationSec=provider.metadata.duration,
        )


def _audio_content_type(path: Path) -> str:
    media_types = {
        ".wav": "audio/wav",
        ".webm": "audio/webm",
        ".ogg": "audio/ogg",
    }
    try:
        return media_types[path.suffix.lower()]
    except KeyError as error:
        raise GatewayOutputError("unsupported turn audio type") from error
