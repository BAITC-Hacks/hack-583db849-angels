"""The surprise question must be specific, short, safe, and profile-free."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from services.ml.app.errors import ServiceError
from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.modules.surprise_question import (
    SurpriseProposal, SurpriseQuestionService, safe_surprise_proposal,
)
from services.ml.app.schemas.contracts import SurpriseRequest


EXAMPLES = Path(__file__).resolve().parents[3] / "docs/contracts/examples/candidate-a/ml"


def example_request() -> SurpriseRequest:
    return SurpriseRequest.model_validate_json(
        (EXAMPLES / "surprise-question.request.json").read_text(encoding="utf-8")
    )


def proposal(**changes: str) -> SurpriseProposal:
    values = {
        "question": (
            "Your robot broke two days before the final. If you could go back, "
            "what would you do differently for the team, not the robot?"
        ),
        "competency": "D",
        "why": "The setback story is about the machine; this asks about the people.",
        "fieldId": "setback",
        "sourceQuote": "Our robot broke two days before the final.",
    }
    return SurpriseProposal.model_validate({**values, **changes})


class FakeGateway:
    def __init__(self, *outputs: SurpriseProposal) -> None:
        self.outputs = list(outputs)
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.outputs.pop(0), provider=Provider.OPENAI,
            model="synthetic-model", input_tokens=1, output_tokens=1,
            replayed=True, cached=False,
        )


def test_generator_uses_only_application_without_identity_or_profile() -> None:
    gateway = FakeGateway(proposal())
    result = asyncio.run(SurpriseQuestionService(gateway).prepare(example_request()))
    assert result.question == proposal().question
    assert result.competency == "D"
    assert result.why == proposal().why
    assert len(gateway.requests) == 1
    sent = gateway.requests[0]
    assert sent.task is TaskName.SURPRISE_QUESTION
    assert sent.output_schema is SurpriseProposal
    assert sent.payload["attempt"] == 1
    assert len(sent.payload["application"]) == 4
    assert "candidateId" not in json.dumps(sent.payload)
    assert "profile" not in json.dumps(sent.payload)
    assert "englishCertificate" not in json.dumps(sent.payload)
    assert "test" not in sent.payload
    assert "90 seconds" in sent.prompt


def test_forty_word_boundary_and_forbidden_topics() -> None:
    request = example_request()
    sources = {item.fieldId: item.answer for item in request.candidate.application.answers}
    forty = (
        "Your robot broke two days before the final. If you could go back, "
        "given that your teammates had already worked overnight and needed "
        "a clear plan for the morning, what would you do differently for the "
        "team, not the robot?"
    )
    assert len(forty.split()) == 40
    assert safe_surprise_proposal(proposal(question=forty), sources)
    assert not safe_surprise_proposal(
        proposal(question=forty.replace("robot?", "robot today?")), sources
    )
    for question in (
        "Your robot broke. What does your family think?",
        "Your robot broke. How much money does your family have?",
        "Your robot broke. What health issue affected you?",
        "Your robot broke. Which school and region are you from?",
        "Your robot broke. What is your email address?",
        "Your robot broke. Should we admit you?",
    ):
        assert not safe_surprise_proposal(proposal(question=question), sources)


@pytest.mark.parametrize("changes", [
    {"fieldId": "missing"},
    {"sourceQuote": "The robot won the final."},
    {"sourceQuote": "our robot broke two days before the final."},
    {"sourceQuote": "robot", "question": "What would you do if your robot broke?"},
    {"question": "How do you lead a team?"},
    {"question": "Robot broke? What happened next?"},
    {"question": "Robot broke. Tell me about [redacted]?"},
    {"why": "Ask about the candidate's family."},
])
def test_ungrounded_or_unsafe_proposal_is_rejected(changes: dict[str, str]) -> None:
    request = example_request()
    sources = {item.fieldId: item.answer for item in request.candidate.application.answers}
    assert not safe_surprise_proposal(proposal(**changes), sources)


def test_unsafe_output_retries_once_and_raises_safe_error() -> None:
    gateway = FakeGateway(
        proposal(question="Your robot broke. What does your family think?"),
        proposal(question="Your robot broke. What is your phone number?"),
    )
    with pytest.raises(GatewayOutputError, match="surprise-question output was invalid"):
        asyncio.run(SurpriseQuestionService(gateway).prepare(example_request()))
    assert [item.payload["attempt"] for item in gateway.requests] == [1, 2]


def test_unsafe_output_can_recover_on_second_attempt() -> None:
    gateway = FakeGateway(proposal(question="How do you lead a team?"), proposal())
    result = asyncio.run(SurpriseQuestionService(gateway).prepare(example_request()))
    assert result.question == proposal().question
    assert [item.payload["attempt"] for item in gateway.requests] == [1, 2]


def test_empty_or_ambiguous_application_fails_before_model_call() -> None:
    request = example_request()
    request.candidate.application.answers = []
    gateway = FakeGateway()
    with pytest.raises(ServiceError):
        asyncio.run(SurpriseQuestionService(gateway).prepare(request))
    request = example_request()
    request.candidate.application.answers[1].fieldId = "motivation"
    with pytest.raises(ServiceError):
        asyncio.run(SurpriseQuestionService(gateway).prepare(request))
    assert not gateway.requests
