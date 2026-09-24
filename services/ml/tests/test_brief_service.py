import asyncio
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.modules.brief import BriefGenerator, BriefService
from services.ml.app.schemas.contracts import BriefRequest, BriefResult, Metric


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"


def example() -> tuple[BriefRequest, BriefResult]:
    request = BriefRequest.model_validate(json.loads(
        (EXAMPLES / "brief.request.json").read_text(encoding="utf-8")
    ))
    result = BriefResult.model_validate(json.loads(
        (EXAMPLES / "brief.response.json").read_text(encoding="utf-8")
    ))
    return request, result


class FakeGateway:
    def __init__(self, responses: list[BriefResult]) -> None:
        self.responses = responses
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.responses[len(self.requests) - 1],
            provider=Provider.OPENAI, model="synthetic-model",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


def test_service_grounds_a_and_embeds_before_consistency() -> None:
    request, proposed = example()
    gateway = FakeGateway([proposed])
    result = asyncio.run(BriefService(BriefGenerator(gateway)).prepare(request))
    assert len(gateway.requests) == 1
    assert {item.focus for item in result.questions} == {
        "D", "R", "I", "V", "E", "invision_knowledge", "english", "motivation"
    }
    assert result.consistency[0].status == "discrepancy"
    assert result.consistency[0].claim.evidence[0].quote == "C2"
    assert result.consistency[0].observation.metric.value == "B2"
    assert result.consistency[0].askInInterview
    assert result.consistency[1].claim.evidence[0].sourceId == "motivation"
    assert result.consistency[1].status == "unverified"
    assert result.english.certificate.score == "6.5"
    assert result.english.certificate.cefr == "not verified"


def test_certificate_level_is_not_taken_from_unverified_model_mapping() -> None:
    request, proposed = example()
    proposed.english.certificate.cefr = "C2"
    result = asyncio.run(BriefService(BriefGenerator(FakeGateway([proposed]))).prepare(request))
    assert result.english.certificate.type == "IELTS"
    assert result.english.certificate.score == "6.5"
    assert result.english.certificate.cefr == "not verified"


def test_model_cannot_invent_written_cefr() -> None:
    request, proposed = example()
    proposed.english.writtenCefr = "C2"
    result = asyncio.run(BriefService(BriefGenerator(FakeGateway([proposed]))).prepare(request))
    assert result.english.writtenCefr == "not assessed"


def test_no_simulation_metric_cannot_be_invented_by_model() -> None:
    request, proposed = example()
    request.simulationEnglish = None
    gateway = FakeGateway([proposed])
    result = asyncio.run(BriefService(BriefGenerator(gateway)).prepare(request))
    assert result.consistency[0].status == "unverified"
    assert result.consistency[0].observation.metric is None
    assert all(item.observation.metric is None for item in result.consistency)


def test_invented_metric_and_certificate_are_not_returned() -> None:
    request, proposed = example()
    proposed.consistency[1].observation.metric = Metric(
        name="cefrEstimate", value="C2", source="simulation"
    )
    proposed.english.certificate.score = "9.0"
    result = asyncio.run(BriefService(BriefGenerator(FakeGateway([proposed]))).prepare(request))
    assert len(result.consistency) == 2  # No model-selected metric for another topic.
    assert all(
        item.observation.metric is None or item.observation.metric.value == "B2"
        for item in result.consistency
    )
    assert result.english.certificate.score == "6.5"
    assert result.english.certificate.cefr == "not verified"


@pytest.mark.parametrize("model_status", ["consistent", "discrepancy", "confirmed"])
def test_verified_quotes_do_not_validate_model_consistency_status(model_status: str) -> None:
    request, proposed = example()
    proposed.consistency[1].status = model_status
    result = asyncio.run(BriefService(BriefGenerator(FakeGateway([proposed]))).prepare(request))
    item = result.consistency[1]
    assert item.claim.evidence
    assert item.observation.evidence
    assert item.status == "unverified"
    assert "clarify" in item.whatToDo.lower()


def test_fabricated_quote_gets_a_safe_open_question() -> None:
    request, proposed = example()
    proposed.questions[0].evidence[0].quote = "An invented leadership achievement"
    result = asyncio.run(BriefService(BriefGenerator(FakeGateway([proposed]))).prepare(request))
    assert result.questions[0].evidence == []
    assert "invented" not in result.questions[0].question.lower()
    assert "direct interview example" in result.questions[0].why
    assert "invented" not in str(result.model_dump()).lower()


def test_valid_quote_cannot_license_an_invented_question_premise() -> None:
    request, proposed = example()
    proposed.questions[0].question = "Why did you falsify the result?"
    result = asyncio.run(BriefService(BriefGenerator(FakeGateway([proposed]))).prepare(request))
    assert "falsify" not in result.questions[0].question
    assert proposed.questions[0].evidence[0].quote in result.questions[0].question


def test_motivation_question_checks_programme_fit_and_cost_without_a_verdict() -> None:
    request, proposed = example()
    motivation = next(item for item in proposed.questions if item.focus == "motivation")
    motivation.question = "You only applied because the programme is free, right?"
    result = asyncio.run(BriefService(BriefGenerator(FakeGateway([proposed]))).prepare(request))
    question = next(item for item in result.questions if item.focus == "motivation")
    assert "programme supports your goals" in question.question
    assert "free tuition factor" in question.question
    assert "only applied" not in question.question
    assert "without assuming" in question.why


def test_motivation_question_stays_neutral_without_application_evidence() -> None:
    request, proposed = example()
    motivation = next(item for item in proposed.questions if item.focus == "motivation")
    motivation.evidence = []
    result = asyncio.run(BriefService(BriefGenerator(FakeGateway([proposed]))).prepare(request))
    question = next(item for item in result.questions if item.focus == "motivation")
    assert question.evidence == []
    assert question.question.startswith("What in the programme")
    assert "Your application response says" not in question.question


def test_majority_fabricated_evidence_retries_once_then_errors() -> None:
    request, proposed = example()
    for item in proposed.questions:
        for evidence in item.evidence:
            evidence.quote = "fabricated quote"
    for item in proposed.consistency:
        for evidence in item.claim.evidence + item.observation.evidence:
            evidence.quote = "fabricated quote"
    for item in proposed.clarify:
        for evidence in item.evidence:
            evidence.quote = "fabricated quote"
    gateway = FakeGateway([proposed, proposed])
    with pytest.raises(GatewayOutputError, match="brief evidence"):
        asyncio.run(BriefService(BriefGenerator(gateway)).prepare(request))
    assert [item.payload["attempt"] for item in gateway.requests] == [1, 2]
