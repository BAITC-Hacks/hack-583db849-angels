import asyncio
from pathlib import Path

import pytest
from pydantic import ValidationError

from services.ml.app.gateway.config import Provider, TaskName, load_models_configuration
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import GatewayResult, ProviderResponse
from services.ml.app.modules.judge import JudgeOutput, SimulationJudge
from services.ml.app.schemas.contracts import AssessmentRequest, DriveScore, Evidence, Turn


def request() -> AssessmentRequest:
    return AssessmentRequest(
        candidateId="candidate-synthetic", scenarioId="conflict-resolution",
        mode="voice",
        turns=[
            Turn(
                turnId="turn_01", speaker="character", text="What happened?",
                startedAt="2026-09-25T10:00:00Z", endedAt="2026-09-25T10:00:04Z",
            ),
            Turn(
                turnId="turn_02", speaker="candidate",
                text="I asked each owner to review the timeline.",
                startedAt="2026-09-25T10:00:05Z", endedAt="2026-09-25T10:00:15Z",
            ),
        ],
    )


def scores(quote: str = "I asked each owner") -> list[DriveScore]:
    return [
        DriveScore(
            competency=code, score=2, confidence="medium",
            rationale="Observed a concrete action.",
            evidence=[Evidence(source="simulation_turn", sourceId="turn_02", quote=quote)],
        )
        for code in "DRIVE"
    ]


class FakeGateway:
    def __init__(self, responses: list[JudgeOutput]) -> None:
        self.responses = responses
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        output = self.responses[len(self.requests) - 1]
        return GatewayResult(
            output=output, provider=Provider.OPENAI, model="synthetic-model",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


def test_judge_sends_rubric_and_candidate_transcript_through_gateway() -> None:
    gateway = FakeGateway([JudgeOutput(scores=scores())])
    result = asyncio.run(SimulationJudge(gateway).judge(request()))
    assert [item.competency for item in result] == list("DRIVE")
    assert [item.score for item in result] == [2] * 5
    sent = gateway.requests[0]
    assert sent.task == TaskName.SIMULATION_ASSESSMENT
    assert sent.output_schema is JudgeOutput
    assert sent.payload["rubric"]["competencies"][0]["code"] == "D"
    assert sent.payload["rubric"]["scoringPrinciples"]["english_proficiency_affects_scores"] is False
    assert "evidence_examples" not in str(sent.payload["rubric"])
    assert sent.payload["turns"][1]["text"] == request().turns[1].text
    assert "candidateId" not in sent.payload
    assert sent.payload["attempt"] == 1


def test_majority_bad_evidence_retries_once_with_distinct_request() -> None:
    gateway = FakeGateway([
        JudgeOutput(scores=scores("fabricated quote")),
        JudgeOutput(scores=scores()),
    ])
    result = asyncio.run(SimulationJudge(gateway).judge(request()))
    assert len(gateway.requests) == 2
    assert [sent.payload["attempt"] for sent in gateway.requests] == [1, 2]
    assert all(item.score == 2 for item in result)


def test_second_majority_failure_raises_safe_gateway_error() -> None:
    gateway = FakeGateway([JudgeOutput(scores=scores("fabricated quote"))] * 2)
    with pytest.raises(GatewayOutputError, match="evidence"):
        asyncio.run(SimulationJudge(gateway).judge(request()))
    assert len(gateway.requests) == 2


def test_partial_invalid_evidence_drops_quote_and_nulls_only_unsupported_score() -> None:
    mixed = scores()
    mixed[0] = DriveScore(
        competency="D", score=2, confidence="medium", rationale="Observed action.",
        evidence=[
            Evidence(source="simulation_turn", sourceId="turn_02", quote="fabricated"),
        ],
    )
    mixed[1] = DriveScore(
        competency="R", score=2, confidence="medium", rationale="Observed action.",
        evidence=[
            Evidence(source="simulation_turn", sourceId="turn_02", quote="fabricated"),
            Evidence(source="simulation_turn", sourceId="turn_02", quote="I asked each owner"),
        ],
    )
    gateway = FakeGateway([JudgeOutput(scores=mixed)])
    result = asyncio.run(SimulationJudge(gateway).judge(request()))
    assert len(gateway.requests) == 1
    assert result[0].score is None
    assert result[0].confidence is None
    assert result[0].rationale is None
    assert result[1].score == 2
    assert [piece.quote for piece in result[1].evidence] == ["I asked each owner"]


def test_judge_schema_refuses_wrong_order_and_unsupported_scores() -> None:
    with pytest.raises(ValidationError):
        JudgeOutput(scores=list(reversed(scores())))
    with pytest.raises(ValidationError):
        JudgeOutput.model_validate({"scores": [{"competency": "D", "score": 4,
            "confidence": "high", "rationale": "No evidence", "evidence": []}]})


def test_prompt_separates_english_and_leadership() -> None:
    prompt = (Path(__file__).resolve().parents[3] / "config/prompts/m3-judge.md").read_text(
        encoding="utf-8"
    )
    assert "grammar" in prompt
    assert "Do not let language errors" in prompt
    assert "candidate turn" in prompt


class ProviderSequence:
    def __init__(self, contents: list[str]) -> None:
        self.contents = contents
        self.requests = []

    async def generate(self, request):
        self.requests.append(request)
        return ProviderResponse(
            content=self.contents.pop(0), input_tokens=2, output_tokens=2,
        )


class NoopCassettes:
    async def save(self, request, provider, model, response):
        del request, provider, model, response


def test_judge_invalid_json_gets_one_gateway_retry_with_bounded_tokens() -> None:
    provider = ProviderSequence(["not-json", JudgeOutput(scores=scores()).model_dump_json()])
    gateway = ModelGateway(
        mode="live", configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider}, cassettes=NoopCassettes(),
    )
    result = asyncio.run(SimulationJudge(gateway).judge(request()))
    assert all(score.score == 2 for score in result)
    assert len(provider.requests) == 2
    assert [call.max_tokens for call in provider.requests] == [4000, 4000]


def test_judge_two_invalid_json_outputs_fail_without_third_call() -> None:
    provider = ProviderSequence(["not-json", "still-not-json"])
    gateway = ModelGateway(
        mode="live", configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider}, cassettes=NoopCassettes(),
    )
    with pytest.raises(GatewayOutputError):
        asyncio.run(SimulationJudge(gateway).judge(request()))
    assert len(provider.requests) == 2
