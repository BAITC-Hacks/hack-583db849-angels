import asyncio
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.errors import ServiceError
from services.ml.app.modules.consistency import (
    ConsistencyGenerator, ConsistencyService, reconcile_after_items,
)
from services.ml.app.schemas.contracts import (
    BriefResult, ConsistencyRequest, ConsistencyResult, Evidence, Metric,
)


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


def _service(output: ConsistencyResult) -> tuple[ConsistencyService, FakeGateway]:
    gateway = FakeGateway(output)
    brief = FakeBrief(BriefResult.model_validate(json.loads(
        (EXAMPLES / "brief.response.json").read_text(encoding="utf-8")
    )))
    return ConsistencyService(ConsistencyGenerator(gateway), brief), gateway


def test_after_service_grounds_candidate_quotes_and_simulation_metric() -> None:
    request, proposed = example()
    service, gateway = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert [item.status for item in result.items] == ["confirmed", "confirmed", "unverified"]
    assert result.items[0].observation.metric.source == "simulation"
    assert result.items[0].observation.text == proposed.items[0].observation.text
    assert result.items[1].observation.evidence[0].sourceId == "iturn_02"
    assert result.items[2].observation == request.beforeItems[2].observation
    assert all(item.askInInterview is None for item in result.items)
    assert len(gateway.requests) == 1


def test_after_resolves_saved_discrepancy_with_candidate_interview_account() -> None:
    request, proposed = example()
    account = (
        "I asked Dana and Timur for their views before I decided what the team should do."
    )
    next(turn for turn in request.interviewTranscript if turn.turnId == "iturn_02").text = account
    proposed.items[1].observation.evidence[0].quote = account
    proposed.items[1].status = "resolved"
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert request.beforeItems[1].status == "discrepancy"
    assert result.items[1].status == "resolved"
    assert result.items[1].claim == request.beforeItems[1].claim
    assert result.items[1].observation.evidence[0].sourceId == "iturn_02"
    assert result.items[1].observation.text.endswith(account)
    assert result.items[1].askInInterview is None


def test_after_keeps_discrepancy_when_interview_repeats_conflicting_account() -> None:
    request, proposed = example()
    account = proposed.items[1].observation.evidence[0].quote
    proposed.items[1].status = "discrepancy"
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert request.beforeItems[1].status == "discrepancy"
    assert result.items[1].status == "discrepancy"
    assert result.items[1].claim == request.beforeItems[1].claim
    assert result.items[1].observation.evidence[0].sourceId == "iturn_02"
    assert result.items[1].observation.text.endswith(account)
    assert result.items[1].askInInterview is None


@pytest.mark.parametrize("measured", [False, True])
@pytest.mark.parametrize("proposed_status", ["confirmed", "resolved", "discrepancy"])
def test_interview_transcript_alone_cannot_set_english_status(
    measured: bool, proposed_status: str,
) -> None:
    request, proposed = example()
    if not measured:
        request.simulationEnglish = None
        request.beforeItems[0].observation.metric = None
        request.beforeItems[0].status = "unverified"
    original = request.beforeItems[0].model_copy(deep=True)
    proposed.items[0].observation.metric = None
    proposed.items[0].observation.evidence = [Evidence(
        source="interview_turn", sourceId="iturn_02",
        quote=request.interviewTranscript[1].text,
    )]
    proposed.items[0].status = proposed_status
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert reconcile_after_items(request.beforeItems, proposed).items[0].status == original.status
    assert result.items[0].status == original.status
    assert result.items[0].observation == original.observation
    assert result.items[0].claim == original.claim


def test_speaking_rate_cannot_confirm_a_cefr_claim() -> None:
    request, proposed = example()
    original = request.beforeItems[0].model_copy(deep=True)
    proposed.items[0].observation.metric = Metric(
        name="wordsPerMinute", value=request.simulationEnglish.wordsPerMinute,
        source="simulation",
    )
    proposed.items[0].status = "confirmed"
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert reconcile_after_items(request.beforeItems, proposed).items[0].status == original.status
    assert result.items[0].status == original.status
    assert result.items[0].observation == original.observation


def test_tampered_saved_quote_is_rejected_before_model_call() -> None:
    request, proposed = example()
    request.beforeItems[0].claim.evidence[0].quote = "Invented C2 quote"
    service, gateway = _service(proposed)

    with pytest.raises(ServiceError) as error:
        asyncio.run(service.prepare(request))

    assert error.value.status_code == 422
    assert gateway.requests == []


def test_wrong_speaker_quote_cannot_confirm_a_saved_item() -> None:
    request, proposed = example()
    proposed.items[1].observation.evidence[0].sourceId = "iturn_01"
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert result.items[1].status == request.beforeItems[1].status
    assert result.items[1].observation == request.beforeItems[1].observation


def test_generic_candidate_reply_does_not_confirm_discrepancy() -> None:
    request, proposed = example()
    cited_id = proposed.items[1].observation.evidence[0].sourceId
    next(turn for turn in request.interviewTranscript if turn.turnId == cited_id).text = "Yes."
    proposed.items[1].observation.evidence[0].quote = "Yes."
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert result.items[1].status == request.beforeItems[1].status


def test_unsupported_appended_item_is_dropped() -> None:
    request, proposed = example()
    new = proposed.items[1].model_copy(deep=True)
    new.itemId = "new"
    new.claim.evidence[0].sourceId = "missing-field"
    proposed.items.append(new)
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert [item.itemId for item in result.items] == ["c_01", "c_02", "c_03"]


def test_grounded_appended_item_gets_next_id() -> None:
    request, proposed = example()
    new = proposed.items[1].model_copy(deep=True)
    new.itemId = "model-selected-id"
    new.claim.evidence[0].sourceId = "english_self"
    new.claim.evidence[0].quote = "C2."
    proposed.items.append(new)
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert result.items[-1].itemId == "c_04"
    assert result.items[-1].status == "discrepancy"
    assert result.items[-1].claim.evidence[0].source == "application_field"
    assert result.items[-1].observation.evidence[0].source == "interview_turn"
    assert result.items[-1].askInInterview is None


def test_existing_observation_names_the_interview_quote_not_the_first_quote() -> None:
    request, proposed = example()
    interview_quote = proposed.items[1].observation.evidence[0].quote
    proposed.items[1].observation.evidence.insert(0, Evidence(
        source="simulation_turn", sourceId="turn_02", quote="Okay, let's fix this fast.",
    ))
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert result.items[1].observation.text == (
        f"The candidate said in the interview: {interview_quote}"
    )


def test_new_item_names_application_and_interview_quotes_in_mixed_evidence() -> None:
    request, proposed = example()
    new = proposed.items[1].model_copy(deep=True)
    new.itemId = "model-selected-id"
    application_quote = new.claim.evidence[0].quote
    interview_quote = new.observation.evidence[0].quote
    new.claim.evidence.insert(0, Evidence(
        source="test_item", sourceId="block_03",
        quote="I prefer to decide quickly and explain my reasons later.",
    ))
    new.observation.evidence.insert(0, Evidence(
        source="simulation_turn", sourceId="turn_02", quote="Okay, let's fix this fast.",
    ))
    proposed.items.append(new)
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert result.items[-1].claim.text == f"The application response says: {application_quote}"
    assert result.items[-1].observation.text == (
        f"The candidate said in the interview: {interview_quote}"
    )


def test_exactly_half_bad_quotes_does_not_trigger_retry() -> None:
    request, proposed = example()
    proposed.items[1].claim.evidence[0].quote = "Invented claim"
    proposed.items[2].claim.evidence[0].quote = "Invented claim"
    service, gateway = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert result.items[1].claim == request.beforeItems[1].claim
    assert len(gateway.requests) == 1


def test_majority_bad_quotes_retry_once_then_fail_safely() -> None:
    request, proposed = example()
    for item in proposed.items:
        item.claim.evidence[0].quote = "Invented quote"
    service, gateway = _service(proposed)

    with pytest.raises(GatewayOutputError):
        asyncio.run(service.prepare(request))

    assert [sent.payload["attempt"] for sent in gateway.requests] == [1, 2]


def test_unsupported_model_metric_retries_once() -> None:
    request, proposed = example()
    proposed.items[0].observation.metric.source = "interview"
    service, gateway = _service(proposed)

    with pytest.raises(GatewayOutputError):
        asyncio.run(service.prepare(request))

    assert len(gateway.requests) == 2


def test_fabricated_quote_is_never_logged(caplog: pytest.LogCaptureFixture) -> None:
    request, proposed = example()
    marker = "Synthetic private answer must not appear in a log"
    proposed.items[1].observation.evidence[0].quote = marker
    service, _ = _service(proposed)

    result = asyncio.run(service.prepare(request))

    assert result.items[1].status == request.beforeItems[1].status
    assert marker not in caplog.text
