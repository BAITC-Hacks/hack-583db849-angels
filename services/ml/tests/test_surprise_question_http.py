"""The public ML contract stays frozen while S uses real replay logic."""

from __future__ import annotations

from decimal import Decimal
import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.modules.surprise_question import (
    SurpriseProposal, safe_surprise_proposal,
)
from services.ml.app.schemas.contracts import SurpriseResult
from services.ml.scripts.build_surprise_question_cassettes import seed_request


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
TOKEN = {"X-Internal-Token": "test-internal-token"}


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


@pytest.mark.parametrize("label", list("abc"))
def test_seed_question_uses_its_own_application_in_replay(
    client: TestClient, label: str,
) -> None:
    request = seed_request(label)
    response = client.post(
        "/internal/v1/surprise-question",
        json=request.model_dump(mode="json"), headers=TOKEN,
    )
    assert response.status_code == 200
    result = SurpriseResult.model_validate(response.json())
    proposal = SurpriseProposal.model_validate_json((
        ROOT / "seed/candidates" / label / "surprise-question-proposal.json"
    ).read_text(encoding="utf-8"))
    sources = {item.fieldId: item.answer for item in request.candidate.application.answers}
    assert safe_surprise_proposal(proposal, sources)
    assert result == SurpriseResult(
        question=proposal.question, competency=proposal.competency, why=proposal.why,
    )
    assert len(result.question.split()) <= 40
    assert "sourceQuote" not in response.json()
    assert "fieldId" not in response.json()
    if label == "a":
        expected = json.loads((
            EXAMPLES / "surprise-question.response.json"
        ).read_text(encoding="utf-8"))
        assert response.json() == expected


def test_application_change_cannot_reuse_seed_cassette(client: TestClient) -> None:
    request = seed_request("a").model_dump(mode="json")
    request["candidate"]["application"]["answers"][2]["answer"] = (
        "A different synthetic setback."
    )
    response = client.post(
        "/internal/v1/surprise-question", json=request, headers=TOKEN,
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_UNAVAILABLE"
    assert "different synthetic setback" not in response.text.lower()


def test_profile_is_rejected_before_model_call(client: TestClient) -> None:
    request = seed_request("a").model_dump(mode="json")
    request["candidate"]["profile"] = {"fullName": "Synthetic Person"}
    response = client.post(
        "/internal/v1/surprise-question", json=request, headers=TOKEN,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "Synthetic Person" not in response.text


def test_surprise_question_requires_internal_token(client: TestClient) -> None:
    response = client.post(
        "/internal/v1/surprise-question",
        json=seed_request("a").model_dump(mode="json"),
    )
    assert response.status_code == 401


def test_cassette_builder_is_repeatable_without_changes() -> None:
    import asyncio

    from services.ml.scripts.build_surprise_question_cassettes import build

    directory = ROOT / "fixtures/cassettes/surprise_question"
    before = {path.name: path.read_bytes() for path in directory.glob("*.json")}
    asyncio.run(build())
    after = {path.name: path.read_bytes() for path in directory.glob("*.json")}
    assert len(before) == len(after) == 3
    assert before == after
