import asyncio
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.modules.consistency import (
    ConsistencyGenerator, ConsistencyService, reconcile_after_items,
)
from services.ml.app.schemas.contracts import BriefResult, ConsistencyRequest, ConsistencyResult


EXAMPLES = Path(__file__).resolve().parents[3] / "docs/contracts/examples/candidate-a/ml"
ROOT = Path(__file__).resolve().parents[3]


class FakeGateway:
    def __init__(self, output: ConsistencyResult) -> None:
        self.output = output
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.output, provider=Provider.OPENAI, model="synthetic-model",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


class FakeBrief:
    def __init__(self, output: BriefResult) -> None:
        self.output = output
        self.requests = []

    async def prepare(self, request):
        self.requests.append(request)
        return self.output


def example() -> tuple[ConsistencyRequest, ConsistencyResult]:
    request = ConsistencyRequest.model_validate(json.loads(
        (EXAMPLES / "consistency-after.request.json").read_text(encoding="utf-8")
    ))
    proposal = ConsistencyResult.model_validate(json.loads(
        (EXAMPLES / "consistency-after.response.json").read_text(encoding="utf-8")
    ))
    return request, proposal


def test_a_after_preserves_saved_items_in_order() -> None:
    request, proposed = example()
    proposed.items.reverse()
    proposed.items[0].topic = "other"
    proposed.items[0].claim.text = "Fabricated replacement claim"

    result = reconcile_after_items(request.beforeItems, proposed)

    assert [item.itemId for item in result.items] == ["c_01", "c_02", "c_03"]
    assert [item.status for item in result.items] == ["confirmed", "confirmed", "unverified"]
    for before, after in zip(request.beforeItems, result.items, strict=True):
        assert after.topic == before.topic
        assert after.claim == before.claim
        assert after.askInInterview is None
    assert result.items[1].observation.evidence[0].sourceId == "iturn_02"


def test_new_interview_item_appends_with_next_id() -> None:
    request, proposed = example()
    proposed.items.append(proposed.items[1].model_copy(update={"itemId": "model-selected-id"}))

    result = reconcile_after_items(request.beforeItems, proposed)

    assert [item.itemId for item in result.items] == ["c_01", "c_02", "c_03", "c_04"]
    assert result.items[-1].askInInterview is None


def test_missing_or_duplicate_saved_items_are_rejected() -> None:
    request, proposed = example()
    with pytest.raises(ValueError, match="omitted"):
        reconcile_after_items(request.beforeItems, ConsistencyResult(items=proposed.items[1:]))
    proposed.items.append(proposed.items[0])
    with pytest.raises(ValueError, match="duplicate"):
        reconcile_after_items(request.beforeItems, proposed)


def test_ambiguous_saved_ids_are_rejected() -> None:
    request, proposed = example()
    request.beforeItems[1].itemId = request.beforeItems[0].itemId
    with pytest.raises(ValueError, match="ambiguous"):
        reconcile_after_items(request.beforeItems, proposed)


def test_after_cannot_return_consistent_status() -> None:
    request, proposed = example()
    proposed.items[0].status = "consistent"
    with pytest.raises(ValueError, match="after-stage"):
        reconcile_after_items(request.beforeItems, proposed)


def test_after_does_not_confirm_from_silence_or_interviewer_context() -> None:
    request, proposed = example()
    proposed.items[1].observation.evidence = []
    proposed.items[1].status = "confirmed"

    result = reconcile_after_items(request.beforeItems, proposed)

    assert result.items[1].status == request.beforeItems[1].status
    assert result.items[2].status == "unverified"


@pytest.mark.parametrize("status", ["confirmed", "resolved", "discrepancy", "unverified"])
def test_after_preserves_supported_transition_status(status: str) -> None:
    request, proposed = example()
    proposed.items[1].status = status

    result = reconcile_after_items(request.beforeItems, proposed)

    assert result.items[1].status == status
    assert result.items[1].claim == request.beforeItems[1].claim
    assert result.items[1].askInInterview is None


def test_consistency_generator_uses_typed_gateway_without_profile() -> None:
    request, response = example()
    gateway = FakeGateway(response)

    output = asyncio.run(ConsistencyGenerator(gateway).generate(request, request.beforeItems))

    assert output == response
    sent = gateway.requests[0]
    assert sent.task == TaskName.CONSISTENCY
    assert sent.output_schema is ConsistencyResult
    assert sent.payload["attempt"] == 1
    assert "candidateId" not in sent.payload["candidate"]
    assert sent.payload["beforeItems"] == [
        item.model_dump(mode="json") for item in request.beforeItems
    ]
    assert "profile" not in str(sent.payload)
    assert "interviewer" in sent.prompt
    assert (ROOT / "config/prompts/c-consistency.md").read_bytes() == (
        ROOT / "services/ml/stub_data/prompts/c-consistency.md"
    ).read_bytes()


def test_before_and_empty_after_reuse_the_same_m1_brief() -> None:
    request, proposed = example()
    brief_result = BriefResult.model_validate(json.loads(
        (EXAMPLES / "brief.response.json").read_text(encoding="utf-8")
    ))
    brief = FakeBrief(brief_result)
    gateway = FakeGateway(proposed)
    service = ConsistencyService(ConsistencyGenerator(gateway), brief)

    before = request.model_copy(update={"stage": "before", "beforeItems": []})
    before_result = asyncio.run(service.prepare(before))
    assert before_result.items == brief_result.consistency
    assert gateway.requests == []

    empty_after = request.model_copy(update={"beforeItems": []})
    after_result = asyncio.run(service.prepare(empty_after))
    assert [item.itemId for item in after_result.items] == ["c_01", "c_02", "c_03"]
    assert len(brief.requests) == 2
    assert gateway.requests[0].payload["beforeItems"] == [
        item.model_dump(mode="json") for item in brief_result.consistency
    ]
