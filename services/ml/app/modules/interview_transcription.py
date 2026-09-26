"""Map diarized interview audio to timed human speaker turns."""

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
    speaker: int = Field(ge=0)
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)


class _Utterance(_ProviderModel):
    speaker: int = Field(ge=0)
    transcript: str = Field(min_length=1)
    start: float = Field(ge=0, allow_inf_nan=False)
    end: float = Field(ge=0, allow_inf_nan=False)
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    words: list[_Word] = []


class _Results(_ProviderModel):
    utterances: list[_Utterance] = Field(min_length=1)


class _DeepgramInterview(_ProviderModel):
    metadata: _Metadata
    results: _Results


class InterviewTranscriptionService:
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
                    "diarize_model": "latest",
                },
                # API permits 60 minutes. Reserve the maximum before a live call;
                # the provider's measured duration determines actual billed cost.
                estimated_units=Decimal(60),
            )
        )
        if result.media_type != "application/json":
            raise GatewayOutputError("interview transcription output is invalid")
        try:
            provider = _DeepgramInterview.model_validate(
                json.loads(result.content.decode("utf-8"))
            )
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as error:
            raise GatewayOutputError("interview transcription output is invalid") from error
        return _map_turns(provider)


def _map_turns(provider: _DeepgramInterview) -> TranscribeResult:
    utterances = provider.results.utterances
    speaker_ids = {item.speaker for item in utterances}
    if len(speaker_ids) != 2:
        raise GatewayOutputError("interview diarization did not identify two speakers")
    first_question = next((item for item in utterances if "?" in item.transcript), None)
    if first_question is None:
        raise GatewayOutputError("interview speaker roles are ambiguous")
    if any(
        "?" in item.transcript
        and item.speaker != first_question.speaker
        and item.start < first_question.end
        and first_question.start < item.end
        for item in utterances
    ):
        raise GatewayOutputError("interview speaker roles are ambiguous")
    interviewer_id = first_question.speaker

    turns = []
    previous_start = -1.0
    for item in utterances:
        if (
            not item.transcript.strip()
            or item.end <= item.start
            or item.end > provider.metadata.duration + 0.1
            or item.start < previous_start
            or not _words_agree_with_speaker(item)
        ):
            raise GatewayOutputError("interview transcription timing or speaker is invalid")
        previous_start = item.start
        confidence = (
            min(word.confidence for word in item.words)
            if item.words else item.confidence
        )
        turns.append(TranscribedTurn(
            speaker="interviewer" if item.speaker == interviewer_id else "candidate",
            text=item.transcript.strip(),
            startSec=item.start,
            endSec=item.end,
            confidence=confidence,
        ))
    return TranscribeResult(turns=turns, durationSec=provider.metadata.duration)


# Deepgram also labels every word, and at a turn boundary a word or two often
# carries the other speaker ("…matters most. Right?"). That is noise; an
# utterance whose words mostly belong to someone else is not, and still fails.
_MAX_OTHER_SPEAKER_WORDS = 0.2


def _words_agree_with_speaker(item: _Utterance) -> bool:
    if not item.words:
        return True
    other = sum(1 for word in item.words if word.speaker != item.speaker)
    return other / len(item.words) <= _MAX_OTHER_SPEAKER_WORDS

