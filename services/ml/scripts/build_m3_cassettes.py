"""Build synthetic judge replay fixtures independently of expected reports.

These authored responses exercise the ML pipeline offline. They do not measure
live-model quality and are never selected by candidate id in production code.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.gateway.cassettes import FileCassetteStore
from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import ProviderRequest, ProviderResponse
from services.ml.app.modules.judge import JudgeOutput, SimulationJudge
from services.ml.app.schemas.contracts import AssessmentRequest, DriveScore, Evidence, Turn
from services.ml.scripts.smoke_m2a import _turn as spoken_turn


RECORDED_AT = datetime(2026, 9, 24, tzinfo=timezone.utc)
CASSETTES = Path(os.environ.get("M3_CASSETTES_DIR", ROOT / "fixtures" / "cassettes"))
SEED_ROOT = ROOT / "seed" / "candidates"
# Independently authored fixture judgments, not loaded from expected-assessment.json.
# Evidence quotes are the complete candidate turn text, looked up from transcripts.
JUDGMENTS = {
    "a": {"D": (2, "turn_10"), "R": (2, "turn_06"), "I": (2, "turn_04"), "V": None, "E": (4, "turn_08")},
    "b": {"D": (1, "turn_10"), "R": (2, "turn_04"), "I": (4, "turn_08"), "V": (2, "turn_06"), "E": (3, "turn_08")},
    "c": {"D": (1, "turn_04"), "R": None, "I": None, "V": (0, "turn_08"), "E": (0, "turn_06")},
}


def authored_output(candidate: str, turns: list[Turn]) -> JudgeOutput:
    source = {turn.turnId: turn.text for turn in turns if turn.speaker == "candidate"}
    scores = []
    for competency, judgment in JUDGMENTS[candidate].items():
        if judgment is None:
            scores.append(
                DriveScore(
                    competency=competency, score=None, confidence=None,
                    rationale=None, evidence=[],
                )
            )
            continue
        score, turn_id = judgment
        scores.append(
            DriveScore(
                competency=competency, score=score, confidence="medium",
                rationale="The cited action supports this rubric level in the synthetic walkthrough.",
                evidence=[
                    Evidence(
                        source="simulation_turn", sourceId=turn_id,
                        quote=source[turn_id],
                    )
                ],
            )
        )
    return JudgeOutput(scores=scores)


@dataclass
class SyntheticJudgeProvider:
    next_output: JudgeOutput | None = None

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        del request
        if self.next_output is None:
            raise RuntimeError("synthetic judge output was not set")
        return ProviderResponse(
            content=self.next_output.model_dump_json(),
            input_tokens=120, output_tokens=160,
            request_id="synthetic-m3-judge-fixture",
        )


async def build() -> None:
    provider = SyntheticJudgeProvider()
    gateway = ModelGateway(
        mode="record",
        configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=FileCassetteStore(CASSETTES, clock=lambda: RECORDED_AT),
    )
    judge = SimulationJudge(gateway)
    for candidate in JUDGMENTS:
        turns = [
            Turn.model_validate(item)
            for item in json.loads(
                (SEED_ROOT / candidate / "transcript.json").read_text(encoding="utf-8")
            )
        ]
        session = json.loads(
            (SEED_ROOT / candidate / "m2a-session.json").read_text(encoding="utf-8")
        )
        played = [Turn.model_validate(spoken_turn(1, "character", session["openingLine"], 0))]
        for index, item in enumerate(session["turns"], start=1):
            played.append(Turn.model_validate(spoken_turn(index * 2, "candidate", item["text"], index * 10)))
            played.append(Turn.model_validate(spoken_turn(index * 2 + 1, "character", item["characterLine"], index * 10 + 5)))
        for walkthrough in (turns, played):
            provider.next_output = authored_output(candidate, walkthrough)
            result = await judge.judge(
                AssessmentRequest(
                    candidateId=f"candidate-{candidate}", scenarioId="conflict-resolution",
                    mode="voice", turns=walkthrough,
                )
            )
            if [score.model_dump() for score in result] != [
                score.model_dump() for score in provider.next_output.scores
            ]:
                raise RuntimeError("synthetic judge evidence failed verification")


if __name__ == "__main__":
    asyncio.run(build())
