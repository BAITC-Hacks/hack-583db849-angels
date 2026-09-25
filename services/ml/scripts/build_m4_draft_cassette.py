"""Record a synthetic A interview draft without contacting a model provider.

The authored judgment is separate from the expected report fixture and is
selected only by this offline builder, never by production request handling.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.gateway.cassettes import FileCassetteStore
from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import ProviderRequest, ProviderResponse
from services.ml.app.modules.interview_draft import (
    InterviewDraftGenerator, InterviewDraftService,
)
from services.ml.app.schemas.contracts import DraftRequest, DraftResult, DriveScore, Evidence


TRANSCRIPT = ROOT / "seed/candidates/a/interview-transcript.json"
CASSETTES = ROOT / "fixtures/cassettes"
RECORDED_AT = datetime(2026, 9, 25, tzinfo=timezone.utc)
JUDGMENTS = {
    "D": (2, "medium", "iturn_12", "We cut scope and move on."),
    "R": (3, "medium", "iturn_14", "I would add a 24-hour limit for reviews so nobody is blocked."),
    "I": None,
    "V": (2, "low", "iturn_10", "I felt bad, but rules are rules, so I told the teacher."),
    "E": (4, "high", "iturn_02", "I made a plan straight away: owners, a deadline and a full run on Thursday."),
}


def authored_output(request: DraftRequest) -> DraftResult:
    candidate_turns = {
        turn.turnId: turn.text for turn in request.transcript
        if turn.speaker == "candidate"
    }
    scores = []
    for code, judgment in JUDGMENTS.items():
        if judgment is None:
            scores.append(DriveScore(
                competency=code, score=None, confidence=None, rationale=None, evidence=[],
            ))
            continue
        value, confidence, source_id, quote = judgment
        if quote not in candidate_turns[source_id]:
            raise ValueError("authored quote no longer resolves to candidate speech")
        scores.append(DriveScore(
            competency=code, score=value, confidence=confidence,
            rationale="Synthetic model claim; the service replaces this with a verified citation.",
            evidence=[Evidence(source="interview_turn", sourceId=source_id, quote=quote)],
        ))
    return DraftResult(scores=scores)


class SyntheticDraftProvider:
    def __init__(self, output: DraftResult) -> None:
        self._output = output

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        if request.task.value != "interview_draft":
            raise RuntimeError("unexpected model task")
        return ProviderResponse(
            content=self._output.model_dump_json(),
            input_tokens=180, output_tokens=220,
            request_id="synthetic-m4-draft",
        )


async def build() -> None:
    request = DraftRequest.model_validate({
        "candidateId": "00000000-0000-4000-8000-00000000000a",
        "transcript": json.loads(TRANSCRIPT.read_text(encoding="utf-8")),
        "notes": [],
    })
    authored = authored_output(request)
    gateway = ModelGateway(
        mode="record", configuration=load_models_configuration(),
        providers={Provider.OPENAI: SyntheticDraftProvider(authored)},
        cassettes=FileCassetteStore(CASSETTES, clock=lambda: RECORDED_AT),
    )
    result = await InterviewDraftService(InterviewDraftGenerator(gateway)).prepare(request)
    if [item.score for item in result.scores] != [2, 3, None, 2, 4]:
        raise RuntimeError("synthetic draft score pattern changed")


if __name__ == "__main__":
    asyncio.run(build())
