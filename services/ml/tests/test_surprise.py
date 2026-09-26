"""The surprise question: about the candidate's own application, answerable in 90 seconds, never personal."""

from __future__ import annotations

import asyncio
import json
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.gateway.cassettes import CassetteEnvelope
from services.ml.app.gateway.config import TaskName
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.main import create_app
from services.ml.app.modules.surprise import (
    SurpriseProposal,
    SurpriseQuestionWriter,
    forbidden_topic,
    load_surprise_policy,
)
from services.ml.app.schemas.contracts import SurpriseRequest


ROOT = Path(__file__).resolve().parents[3]
EXAMPLE = ROOT / "docs/contracts/examples/candidate-a/ml/surprise-question.request.json"
CASSETTES = ROOT / "fixtures/cassettes/surprise_question"
POLICY = load_surprise_policy()


def example() -> SurpriseRequest:
    return SurpriseRequest.model_validate(json.loads(EXAMPLE.read_text(encoding="utf-8")))


def proposal(question: str, source: str = "setback", why: str = "The setback is told as a machine story.") -> SurpriseProposal:
    return SurpriseProposal(question=question, competency="D", why=why, sourceFieldId=source)


class FakeGateway:
    def __init__(self, *outputs: SurpriseProposal) -> None:
        self.outputs = list(outputs)
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.outputs.pop(0), provider="openai", model="synthetic",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


GOOD = "Your robot broke two days before the final. What would you do differently for the team next time?"


def test_a_question_about_the_application_is_asked_and_the_id_stays_out() -> None:
    gateway = FakeGateway(proposal(GOOD))
    result = asyncio.run(SurpriseQuestionWriter(gateway).write(example()))

    assert result.model_dump() == {"question": GOOD, "competency": "D", "why": "The setback is told as a machine story."}
    sent = gateway.requests[0]
    assert sent.task == TaskName.SURPRISE_QUESTION
    assert sent.output_schema is SurpriseProposal
    assert "candidateId" not in json.dumps(sent.payload)
    assert sent.payload["candidate"]["application"]["answers"][0]["fieldId"] == "motivation"


@pytest.mark.parametrize(
    ("bad", "reason"),
    [
        (proposal(" ".join(["Why"] * 41) + "?"), "longer than 40 words"),
        (proposal("What does your family think about your robotics team?"), "about family"),
        (proposal("How much money did the robot cost you?"), "about money"),
        (proposal("What would you change about the final?", source="favourite_food"), "not an answer in the application"),
        (proposal("What broke? And what did you learn?"), "two questions"),
    ],
    ids=lambda value: value if isinstance(value, str) else "",
)
def test_a_question_that_cannot_be_asked_is_retried_once_then_refused(bad: SurpriseProposal, reason: str) -> None:
    gateway = FakeGateway(bad, proposal(GOOD))
    assert asyncio.run(SurpriseQuestionWriter(gateway).write(example())).question == GOOD, reason

    gateway = FakeGateway(bad, bad)
    with pytest.raises(GatewayOutputError):
        asyncio.run(SurpriseQuestionWriter(gateway).write(example()))
    assert [request.payload["attempt"] for request in gateway.requests] == [1, 2]


def test_the_topic_check_reads_words_not_parts_of_them() -> None:
    assert forbidden_topic("How would people use the bus app on their phones?", POLICY) is None
    assert forbidden_topic("What did the team learn from the poor start?", POLICY) is None
    assert forbidden_topic("Would your parents agree?", POLICY) is not None


def test_every_recorded_question_passes_the_same_checks() -> None:
    paths = sorted(CASSETTES.glob("*.json"))
    # The contract example, and A, B and C as the API sends them.
    assert len(paths) >= 4
    for path in paths:
        envelope = CassetteEnvelope.model_validate_json(path.read_text(encoding="utf-8"))
        assert envelope.request_hash == path.stem
        recorded = SurpriseProposal.model_validate_json(envelope.response)
        assert recorded.question.strip().endswith("?"), recorded.question
        assert len(recorded.question.split()) <= POLICY.maxWords, recorded.question
        assert forbidden_topic(recorded.question, POLICY) is None, recorded.question
        assert forbidden_topic(recorded.why, POLICY) is None, recorded.why
        assert "candidateId" not in path.read_text(encoding="utf-8")


def test_the_contract_example_replays_offline(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="t", uploads_dir=tmp_path, gateway_mode="replay",
        budget_usd_cap=Decimal("1"), demo_mode=False, usage_log_path=tmp_path / "usage.jsonl",
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    response = client.post(
        "/internal/v1/surprise-question", headers={"X-Internal-Token": "t"},
        json=json.loads(EXAMPLE.read_text(encoding="utf-8")),
    )
    assert response.status_code == 200, response.text
    assert set(response.json()) == {"question", "competency", "why"}


def test_the_proposal_schema_is_accepted_by_strict_json_mode() -> None:
    schema = SurpriseProposal.model_json_schema()
    assert set(schema["required"]) == set(schema["properties"])
    assert schema["additionalProperties"] is False


def test_the_packaged_prompt_and_policy_match_the_owned_ones() -> None:
    packaged = ROOT / "services/ml/stub_data"
    assert (packaged / "prompts/surprise-question.md").read_text() == (ROOT / "config/prompts/surprise-question.md").read_text()
    assert json.loads((packaged / "surprise-question.json").read_text()) == json.loads((ROOT / "config/surprise-question.json").read_text())
