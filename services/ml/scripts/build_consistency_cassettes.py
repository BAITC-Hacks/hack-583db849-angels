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
    if candidate not in "bc":
        raise ValueError("unknown synthetic candidate")
    return json.loads((ROOT / f"seed/candidates/{candidate}/interview-transcript.json").read_text(
        encoding="utf-8"
    ))


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
                text="The application says the candidate makes decisions independently.",
                evidence=[Evidence(
                    source="application_field", sourceId="motivation",
                    quote="I prefer to make decisions independently and usually do not ask for advice.",
                )],
            ),
            observation=Observation(
                text="The interview says the candidate let the team decide.",
                evidence=[Evidence(
                    source="interview_turn", sourceId="iturn_02",
                    quote="I let the team decide. I did not want to push my own idea.",
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
        if candidate == "a":
            # Legacy callers may omit beforeItems; the service reconstructs
            # them through M1 and still uses a request-keyed C cassette.
            empty_after = after_input.model_copy(update={"beforeItems": []})
            provider.output = ConsistencyResult(items=[
                authored_proposal("a", after_input).items[0],
            ])
            fallback = await service.prepare(empty_after)
            if [item.status for item in fallback.items] != ["confirmed"]:
                raise RuntimeError("empty-before fallback changed unexpectedly")


if __name__ == "__main__":
    asyncio.run(build())
