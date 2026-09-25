"""Build synthetic C replay fixtures; no provider network access.

Candidate-specific authorship is limited to this offline fixture builder. The
runtime service always uses the request, configured task and evidence checks.
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
from services.ml.app.modules.brief import BriefGenerator, BriefService
from services.ml.app.modules.consistency import ConsistencyGenerator, ConsistencyService
from services.ml.app.schemas.contracts import (
    Claim, ConsistencyItem, ConsistencyRequest, ConsistencyResult, Evidence, Observation,
)
from services.ml.scripts.build_m1_cassettes import request_for


CASSETTES = ROOT / "fixtures/cassettes"
EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
RECORDED_AT = datetime(2026, 9, 26, tzinfo=timezone.utc)


class SyntheticConsistencyProvider:
    output: ConsistencyResult | None = None

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        if request.task.value != "consistency" or self.output is None:
            raise RuntimeError("unexpected synthetic consistency request")
        return ProviderResponse(
            content=self.output.model_dump_json(), input_tokens=150,
            output_tokens=280, request_id="synthetic-consistency-fixture",
        )


def _interview(candidate: str) -> list[dict]:
    if candidate == "b":
        return [
            {"turnId": "iturn_01", "speaker": "interviewer", "text":
             "What happened after the mentoring plan was rejected?", "startSec": 1, "endSec": 5},
            {"turnId": "iturn_02", "speaker": "candidate", "text":
             "I was disappointed and waited until another student restarted the conversation.",
             "startSec": 6, "endSec": 15},
        ]
    if candidate == "c":
        return [
            {"turnId": "iturn_01", "speaker": "interviewer", "text":
             "Did any project go wrong?", "startSec": 1, "endSec": 4},
            {"turnId": "iturn_02", "speaker": "candidate", "text":
             "Actually our event missed its deadline and I had to ask the team to rebuild the plan.",
             "startSec": 5, "endSec": 17},
        ]
    raise ValueError("unknown synthetic candidate")


def before_request(candidate: str) -> ConsistencyRequest:
    brief = request_for(candidate, with_english=True)
    turns = json.loads((ROOT / f"seed/candidates/{candidate}/transcript.json").read_text(
        encoding="utf-8"
    ))
    return ConsistencyRequest(
        stage="before", candidate=brief.candidate,
        simulationEnglish=brief.simulationEnglish, simulationTurns=turns,
    )


def after_request(candidate: str, before: ConsistencyResult) -> ConsistencyRequest:
    if candidate == "a":
        return ConsistencyRequest.model_validate_json(
            (EXAMPLES / "consistency-after.request.json").read_text(encoding="utf-8")
        )
    prior = before_request(candidate)
    return ConsistencyRequest(
        stage="after", candidate=prior.candidate,
        simulationEnglish=prior.simulationEnglish,
        simulationTurns=prior.simulationTurns,
        interviewTranscript=_interview(candidate), beforeItems=before.items,
    )


def authored_proposal(candidate: str, request: ConsistencyRequest) -> ConsistencyResult:
    if candidate == "a":
        return ConsistencyResult.model_validate_json(
            (EXAMPLES / "consistency-after.response.json").read_text(encoding="utf-8")
        )
    items = [item.model_copy(deep=True) for item in request.beforeItems]
    for item in items:
        item.askInInterview = None
    if candidate == "b":
        return ConsistencyResult(items=items)
    if candidate == "c":
        items.append(ConsistencyItem(
            itemId="model-new-item", topic="other",
            claim=Claim(
                text="The application said nothing important went wrong.",
                evidence=[Evidence(
                    source="application_field", sourceId="setback",
                    quote="Nothing important has gone wrong in my projects.",
                )],
            ),
            observation=Observation(
                text="The interview described a missed deadline.",
                evidence=[Evidence(
                    source="interview_turn", sourceId="iturn_02",
                    quote="Actually our event missed its deadline and I had to ask the team to rebuild the plan.",
                )], metric=None,
            ),
            status="discrepancy",
            whatToDo="Ask what changed and how the deadline was handled.",
            askInInterview=None,
        ))
        return ConsistencyResult(items=items)
    raise ValueError("unknown synthetic candidate")


async def build() -> None:
    store = FileCassetteStore(CASSETTES, clock=lambda: RECORDED_AT)
    models = load_models_configuration()
    replay = ModelGateway(
        mode="replay", configuration=models, providers={}, cassettes=store,
    )
    provider = SyntheticConsistencyProvider()
    record = ModelGateway(
        mode="record", configuration=models, providers={Provider.OPENAI: provider},
        cassettes=store,
    )
    service = ConsistencyService(
        ConsistencyGenerator(record), BriefService(BriefGenerator(replay)),
    )
    for candidate in "abc":
        before_input = before_request(candidate)
        before = await service.prepare(before_input)
        after_input = after_request(candidate, before)
        provider.output = authored_proposal(candidate, after_input)
        after = await service.prepare(after_input)
        if len(after.items) < len(after_input.beforeItems):
            raise RuntimeError("synthetic output lost a saved consistency item")


if __name__ == "__main__":
    asyncio.run(build())
