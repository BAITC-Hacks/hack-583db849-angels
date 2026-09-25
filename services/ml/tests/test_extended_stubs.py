import json
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
TOKEN = {"X-Internal-Token": "test-internal-token"}


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    audio = tmp_path / "tmp" / "recordings" / "6f1c2a0e-a004.webm"
    audio.parent.mkdir(parents=True)
    audio.write_bytes(b"synthetic audio placeholder")
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def example(filename: str) -> object:
    return json.loads((EXAMPLES / filename).read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    ("path", "request_name", "response_name"),
    [
        (
            "/internal/v1/consistency",
            "consistency-before.request.json",
            "consistency-before.response.json",
        ),
        (
            "/internal/v1/consistency",
            "consistency-after.request.json",
            "consistency-after.response.json",
        ),
        (
            "/internal/v1/surprise-question",
            "surprise-question.request.json",
            "surprise-question.response.json",
        ),
        (
            "/internal/v1/interview/draft",
            "interview-draft.request.json",
            "interview-draft.response.json",
        ),
        (
            "/internal/v1/quality-check",
            "quality-check-interview.request.json",
            "quality-check-interview.response.json",
        ),
        (
            "/internal/v1/quality-check",
            "quality-check-calibration.request.json",
            "quality-check-calibration.response.json",
        ),
    ],
)
def test_extended_post_stubs_return_the_frozen_examples(
    client: TestClient,
    path: str,
    request_name: str,
    response_name: str,
) -> None:
    response = client.post(path, json=example(request_name), headers=TOKEN)

    assert response.status_code == 200
    assert response.json() == example(response_name)


def test_empty_usage_log_returns_zero_counts(client: TestClient) -> None:
    response = client.get("/internal/v1/usage", headers=TOKEN)

    assert response.status_code == 200
    assert response.json() == {
        "gatewayMode": "replay",
        "liveCalls": 0,
        "replayedCalls": 0,
        "spentUsd": 0.0,
        "capUsd": 20.0,
    }


def test_draft_rejects_interviewer_scores(client: TestClient) -> None:
    request = example("interview-draft.request.json")
    request["interviewerScores"] = [{"competency": "D", "score": 4}]

    response = client.post(
        "/internal/v1/interview/draft",
        json=request,
        headers=TOKEN,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_candidate_view_rejects_profile_over_http(client: TestClient) -> None:
    request = example("surprise-question.request.json")
    request["candidate"]["profile"] = {"fullName": "Synthetic Person"}

    response = client.post(
        "/internal/v1/surprise-question",
        json=request,
        headers=TOKEN,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "Synthetic Person" not in response.text
