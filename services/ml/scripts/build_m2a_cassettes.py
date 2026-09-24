"""Build deterministic replay cassettes from the synthetic A/B/C M2a sessions."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import sys
import wave


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.gateway.cassettes import FileCassetteStore
from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.media import (
    FileMediaCassetteStore,
    MediaGateway,
    MediaProviderRequest,
    MediaProviderResponse,
)
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import ProviderRequest, ProviderResponse
from services.ml.app.modules.actor import ScenarioActor
from services.ml.app.modules.director import ScenarioDirector
from services.ml.app.modules.matcher import MatchResult
from services.ml.app.modules.speech import SpeechService
from services.ml.app.modules.transcription import TurnTranscriptionService
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.app.schemas.contracts import (
    SpeechRequest,
    TranscribeRequest,
    Turn,
    TurnRequest,
    TurnState,
)


RECORDED_AT = datetime(2026, 9, 24, tzinfo=timezone.utc)
CASSETTES = ROOT / "fixtures" / "cassettes"
AUDIO = ROOT / "fixtures" / "audio"


class SeedMatcher:
    def __init__(self, expected: dict[str, str]) -> None:
        self._expected = expected

    def match(self, scenario, beat_id: str, candidate_text: str) -> MatchResult:
        expected_id = self._expected[candidate_text]
        beat = next(item for item in scenario.beats if item.beatId == beat_id)
        answer = next(
            item
            for item in (*beat.answerTypes, beat.fallback)
            if item.answerTypeId == expected_id
        )
        return MatchResult(answer_type=answer, similarity=1.0, used_fallback=False)


@dataclass
class SyntheticModelProvider:
    next_line: str = ""

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        del request
        return ProviderResponse(
            content=json.dumps({"text": self.next_line}),
            input_tokens=40,
            output_tokens=max(1, len(self.next_line.split())),
            request_id="synthetic-m2a-fixture",
        )


class SyntheticMediaProvider:
    def __init__(self, transcripts: dict[str, tuple[str, float]]) -> None:
        self._transcripts = transcripts
        self._speech = (AUDIO / "silence.mp3").read_bytes()

    async def execute(self, request: MediaProviderRequest) -> MediaProviderResponse:
        if request.operation == "speech":
            return MediaProviderResponse(
                content=self._speech,
                media_type="audio/mpeg",
                billed_units=request.estimated_units,
                request_id="synthetic-m2a-speech",
            )
        digest = _sha256(request.content)
        text, duration = self._transcripts[digest]
        words = text.split()
        step = duration / max(len(words), 1)
        payload = {
            "metadata": {"duration": duration},
            "results": {
                "channels": [
                    {
                        "alternatives": [
                            {
                                "transcript": text,
                                "confidence": 0.99,
                                "words": [
                                    {
                                        "word": word.strip(".,?!'").lower(),
                                        "punctuated_word": word,
                                        "start": round(index * step, 3),
                                        "end": round((index + 1) * step, 3),
                                        "confidence": 0.99,
                                    }
                                    for index, word in enumerate(words)
                                ],
                            }
                        ]
                    }
                ]
            },
        }
        return MediaProviderResponse(
            content=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            media_type="application/json",
            billed_units=Decimal(str(duration)) / Decimal(60),
            request_id="synthetic-m2a-transcription",
        )


async def build() -> None:
    sessions = [_load_session(name) for name in ("a", "b", "c")]
    transcripts = _transcript_inventory(sessions)
    configuration = load_models_configuration()
    media_provider = SyntheticMediaProvider(transcripts)
    media_gateway = MediaGateway(
        mode="record",
        configuration=configuration,
        providers={Provider.DEEPGRAM: media_provider},
        cassettes=FileMediaCassetteStore(CASSETTES, clock=lambda: RECORDED_AT),
    )
    transcription = TurnTranscriptionService(media_gateway)
    scenarios = ScenarioRepository.load(ROOT_SCENARIOS)
    speech = SpeechService(media_gateway, scenarios)
    model_provider = SyntheticModelProvider()
    actor = ScenarioActor(
        ModelGateway(
            mode="record",
            configuration=configuration,
            providers={Provider.OPENAI: model_provider},
            cassettes=FileCassetteStore(CASSETTES, clock=lambda: RECORDED_AT),
        )
    )
    scenario = scenarios.get("conflict-resolution")
    if scenario is None:
        raise RuntimeError("conflict-resolution scenario is unavailable")

    for session in sessions:
        director = ScenarioDirector(
            SeedMatcher(
                {item["text"]: item["expectedAnswerType"] for item in session["turns"]}
            )
        )
        transcript: list[Turn] = []
        opening_request = TurnRequest(scenarioId=scenario.scenarioId, turns=[])
        opening = director.direct(scenario, opening_request)
        model_provider.next_line = session["openingLine"]
        line = await actor.generate(scenario, opening, transcript)
        await speech.synthesize(SpeechRequest(text=line, scenarioId=scenario.scenarioId))
        transcript.append(_turn(1, "character", line, 0))
        next_beat = opening.decision.nextBeat

        for index, item in enumerate(session["turns"], start=1):
            audio_path = AUDIO / item["audioRef"]
            recognised = await transcription.transcribe(
                TranscribeRequest(
                    purpose="turn",
                    audioRef=item["audioRef"],
                    language="en",
                    speakers=1,
                ),
                audio_path,
            )
            if len(recognised.turns) != 1 or recognised.turns[0].text != item["text"]:
                raise RuntimeError("synthetic transcription does not match seed")
            transcript.append(_turn(index * 2, "candidate", item["text"], index * 10))
            request = TurnRequest(
                scenarioId=scenario.scenarioId,
                turns=transcript,
                state=TurnState(beat=next_beat, candidateTurns=index),
            )
            outcome = director.direct(scenario, request)
            if (
                outcome.decision.matchedAnswerType != item["expectedAnswerType"]
                or outcome.decision.nextBeat != item["expectedNextBeat"]
            ):
                raise RuntimeError("synthetic session branch does not match seed")
            model_provider.next_line = item["characterLine"]
            line = await actor.generate(scenario, outcome, transcript)
            await speech.synthesize(
                SpeechRequest(text=line, scenarioId=scenario.scenarioId)
            )
            transcript.append(
                _turn(index * 2 + 1, "character", line, index * 10 + 5)
            )
            next_beat = outcome.decision.nextBeat


def _load_session(candidate: str) -> dict:
    path = ROOT / "seed" / "candidates" / candidate / "m2a-session.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _transcript_inventory(sessions: list[dict]) -> dict[str, tuple[str, float]]:
    result = {}
    for session in sessions:
        for item in session["turns"]:
            path = AUDIO / item["audioRef"]
            with wave.open(str(path), "rb") as source:
                duration = source.getnframes() / source.getframerate()
            result[_sha256(path.read_bytes())] = (item["text"], duration)
    return result


def _turn(number: int, speaker: str, text: str, second: int) -> Turn:
    return Turn(
        turnId=f"turn_{number:02d}",
        speaker=speaker,
        text=text,
        startedAt=f"2026-09-25T10:00:{second:02d}Z",
        endedAt=f"2026-09-25T10:00:{second + 4:02d}Z",
    )


def _sha256(content: bytes) -> str:
    from hashlib import sha256

    return sha256(content).hexdigest()


if __name__ == "__main__":
    asyncio.run(build())
