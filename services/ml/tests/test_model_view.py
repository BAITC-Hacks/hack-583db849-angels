"""The API and the replay scripts must reach the same cassette for the same content.

The API sends real candidate ids and real turn times; the scripts that record
cassettes send synthetic ones. Neither may change the key, or every request the
API makes in `replay` misses its cassette and answers 503.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from services.ml.app.gateway.canonical import cassette_key
from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.types import GatewayRequest
from services.ml.app.modules.actor import ScenarioActor
from services.ml.app.modules.brief import BriefGenerator
from services.ml.app.modules.director import DirectorOutcome
from services.ml.app.modules.judge import SimulationJudge
from services.ml.app.scenarios import ScenarioRepository
from services.ml.app.schemas.contracts import (
    AssessmentRequest,
    BriefRequest,
    DirectorDecision,
    Turn,
)

ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"


class _Captured(Exception):
    pass


class CapturingGateway:
    def __init__(self) -> None:
        self.requests: list[GatewayRequest[Any]] = []

    async def execute(self, request: GatewayRequest[Any]) -> Any:
        self.requests.append(request)
        raise _Captured


def captured_key(run) -> str:
    gateway = CapturingGateway()
    try:
        asyncio.run(run(gateway))
    except _Captured:
        pass
    assert len(gateway.requests) == 1
    return cassette_key(gateway.requests[0], Provider.OPENAI, "any-model")


def transcript(start: str) -> list[Turn]:
    return [
        Turn.model_validate({"turnId": "turn_01", "speaker": "character", "text": "I'm out.",
                             "startedAt": f"{start}:00Z", "endedAt": f"{start}:04Z"}),
        Turn.model_validate({"turnId": "turn_02", "speaker": "candidate",
                             "text": "What would make this feel fair to you?",
                             "startedAt": f"{start}:10Z", "endedAt": f"{start}:14Z"}),
    ]


def test_actor_key_ignores_turn_times() -> None:
    scenario = ScenarioRepository.load(ROOT / "config" / "scenarios").get("conflict-resolution")
    assert scenario is not None
    outcome = DirectorOutcome(
        stage="in-progress",
        ended=False,
        decision=DirectorDecision(beat="opening", matchedAnswerType="acknowledge",
                                  similarity=0.9, nextBeat="trust", reason="Safe reason."),
        character_intent="Calms down.",
    )

    def run(turns: list[Turn]):
        return lambda gateway: ScenarioActor(gateway).generate(scenario, outcome, turns)

    assert captured_key(run(transcript("2026-09-25T10:00"))) == captured_key(
        run(transcript("2026-09-24T16:31"))
    )


def test_judge_key_ignores_turn_times_and_the_candidate_id() -> None:
    def run(candidate_id: str, start: str):
        request = AssessmentRequest(candidateId=candidate_id, scenarioId="conflict-resolution",
                                    mode="voice", turns=transcript(start))
        return lambda gateway: SimulationJudge(gateway).judge(request)

    assert captured_key(run("synthetic-a", "2026-09-25T10:00")) == captured_key(
        run("72aaf169-8668-49b5-90d9-1854d01ae113", "2026-09-24T16:31")
    )


def test_brief_key_ignores_the_candidate_id() -> None:
    example = json.loads((EXAMPLES / "brief.request.json").read_text(encoding="utf-8"))

    def run(candidate_id: str):
        body = json.loads(json.dumps(example))
        body["candidate"]["candidateId"] = candidate_id
        request = BriefRequest.model_validate(body)
        return lambda gateway: BriefGenerator(gateway).generate(request)

    assert captured_key(run("00000000-0000-4000-8000-00000000000a")) == captured_key(
        run("72aaf169-8668-49b5-90d9-1854d01ae113")
    )


def test_content_still_changes_the_key() -> None:
    def run(text: str):
        turns = transcript("2026-09-25T10:00")
        turns[1] = turns[1].model_copy(update={"text": text})
        request = AssessmentRequest(candidateId="a", scenarioId="conflict-resolution",
                                    mode="voice", turns=turns)
        return lambda gateway: SimulationJudge(gateway).judge(request)

    assert captured_key(run("What would make this fair?")) != captured_key(run("Just decide."))
