import asyncio
from pathlib import Path

import pytest
from pydantic import ValidationError

from services.ml.app.gateway.config import Provider, TaskName, load_models_configuration
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import GatewayResult, ProviderResponse
from services.ml.app.modules.interview_draft import InterviewDraftGenerator
from services.ml.app.schemas.contracts import (
    DraftRequest, DraftResult, DriveScore, Evidence,
)


def request() -> DraftRequest:
    return DraftRequest.model_validate({
        "candidateId": "synthetic-candidate",
        "transcript": [
            {"turnId": "iturn_01", "speaker": "interviewer", "text": "What did you do?",
             "startSec": 0, "endSec": 2},
            {"turnId": "iturn_02", "speaker": "candidate",
             "text": "I asked each owner to review the plan.", "startSec": 3, "endSec": 8},
        ],
        "notes": [{"id": "note_01", "text": "Candidate mentioned a timeline."}],
    })


def result() -> DraftResult:
    return DraftResult(scores=[
        DriveScore(
            competency=code, score=2, confidence="medium", rationale="Observed action.",
            evidence=[Evidence(
                source="interview_turn", sourceId="iturn_02", quote="I asked each owner",
            )],
        )
        for code in "DRIVE"
    ])


class FakeGateway:
    def __init__(self) -> None:
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=result(), provider=Provider.OPENAI, model="synthetic-model",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


def test_generator_sends_only_transcript_notes_and_rubric() -> None:
    gateway = FakeGateway()
    output = asyncio.run(InterviewDraftGenerator(gateway).generate(request()))

    assert [item.competency for item in output.scores] == list("DRIVE")
    sent = gateway.requests[0]
    assert sent.task == TaskName.INTERVIEW_DRAFT
    assert sent.output_schema is DraftResult
    assert set(sent.payload) == {"rubric", "transcript", "notes", "attempt"}
    assert sent.payload["rubric"]["scoringPrinciples"]["english_proficiency_affects_scores"] is False
    assert [item["code"] for item in sent.payload["rubric"]["competencies"]] == list("DRIVE")
    assert "evidence_examples" not in str(sent.payload["rubric"])
    assert sent.payload["transcript"][1]["text"] == request().transcript[1].text
    assert sent.payload["notes"][0]["id"] == "note_01"
    assert "candidateId" not in sent.payload
    assert "interviewerScores" not in str(sent.payload)
    assert "rawAudio" not in str(sent.payload)
    assert sent.payload["attempt"] == 1


def test_generator_uses_supplied_transcript_not_seed_identity() -> None:
    gateway = FakeGateway()
    generator = InterviewDraftGenerator(gateway)
    changed = request().model_copy(deep=True)
    changed.transcript[1].text = "I consulted the team before changing the plan."
    asyncio.run(generator.generate(request()))
    asyncio.run(generator.generate(changed))

    assert gateway.requests[0].payload["transcript"] != gateway.requests[1].payload["transcript"]
    assert gateway.requests[0].payload["rubric"] == gateway.requests[1].payload["rubric"]


def test_draft_result_rejects_wrong_order_and_missing_evidence() -> None:
    with pytest.raises(ValidationError):
        DraftResult(scores=list(reversed(result().scores)))
    with pytest.raises(ValidationError):
        DraftResult.model_validate({"scores": [
            {"competency": "D", "score": 2, "confidence": "medium",
             "rationale": "No source", "evidence": []},
        ]})


def test_prompt_forbids_human_scores_and_language_penalties() -> None:
    prompt = (Path(__file__).resolve().parents[3] /
              "config/prompts/m4-interview-draft.md").read_text(encoding="utf-8")
    assert "interviewer's own scores" in prompt
    assert "Interviewer speech is context only" in prompt
    assert "grammar" in prompt
    assert "verbatim quote" in prompt


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


def test_invalid_output_gets_one_gateway_retry_with_bounded_tokens() -> None:
    provider = ProviderSequence(["not-json", result().model_dump_json()])
    gateway = ModelGateway(
        mode="live", configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider}, cassettes=NoopCassettes(),
    )
    output = asyncio.run(InterviewDraftGenerator(gateway).generate(request()))
    assert len(output.scores) == 5
    assert len(provider.requests) == 2
    assert [call.max_tokens for call in provider.requests] == [2000, 2000]


def test_two_invalid_outputs_fail_without_third_provider_call() -> None:
    provider = ProviderSequence(["not-json", "still-not-json"])
    gateway = ModelGateway(
        mode="live", configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider}, cassettes=NoopCassettes(),
    )
    with pytest.raises(GatewayOutputError):
        asyncio.run(InterviewDraftGenerator(gateway).generate(request()))
    assert len(provider.requests) == 2
