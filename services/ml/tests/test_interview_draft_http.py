from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.errors import GatewayReplayError
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.main import create_app
from services.ml.app.schemas.contracts import DraftResult, DriveScore, Evidence


TOKEN = {"X-Internal-Token": "test-internal-token"}


def body(text: str = "I asked each owner to review the plan.") -> dict:
    return {
        "candidateId": "synthetic-candidate",
        "transcript": [
            {"turnId": "iturn_01", "speaker": "interviewer", "text": "What did you do?",
             "startSec": 0, "endSec": 2},
            {"turnId": "iturn_02", "speaker": "candidate", "text": text,
             "startSec": 3, "endSec": 8},
        ],
        "notes": [],
    }


class AdaptiveGateway:
    def __init__(self, *, unavailable: bool = False) -> None:
        self.requests = []
        self.unavailable = unavailable

    async def execute(self, request):
        self.requests.append(request)
        if self.unavailable:
            raise GatewayReplayError("cassette unavailable")
        assert request.task == TaskName.INTERVIEW_DRAFT
        quoted = request.payload["transcript"][1]["text"]
        scores = [DriveScore(
            competency="D", score=2, confidence="medium", rationale="Untrusted claim",
            evidence=[Evidence(source="interview_turn", sourceId="iturn_02", quote=quoted)],
        )] + [DriveScore(
            competency=code, score=None, confidence=None, rationale=None, evidence=[],
        ) for code in "RIVE"]
        return GatewayResult(
            output=DraftResult(scores=scores), provider=Provider.OPENAI,
            model="synthetic", input_tokens=1, output_tokens=1,
            replayed=True, cached=False,
        )


def client(tmp_path: Path, gateway: AdaptiveGateway) -> TestClient:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    return TestClient(create_app(settings, model_gateway=gateway), raise_server_exceptions=False)


def test_draft_http_is_authenticated_and_depends_on_supplied_transcript(tmp_path: Path) -> None:
    gateway = AdaptiveGateway()
    http = client(tmp_path, gateway)
    assert http.post("/internal/v1/interview/draft", json=body()).status_code == 401

    first = http.post("/internal/v1/interview/draft", json=body(), headers=TOKEN)
    changed = http.post("/internal/v1/interview/draft", json=body(
        "I checked the timeline with the team."
    ), headers=TOKEN)

    assert first.status_code == changed.status_code == 200
    assert first.json() != changed.json()
    assert len(gateway.requests) == 2
    assert first.json()["scores"][0]["evidence"][0]["quote"] == body()["transcript"][1]["text"]
    assert "Untrusted claim" not in first.text
    assert all("candidateId" not in item.payload for item in gateway.requests)


@pytest.mark.parametrize("field,value", [
    ("interviewerScores", [{"competency": "D", "score": 4}]),
    ("scores", [{"competency": "D", "score": 4}]),
    ("profile", {"fullName": "Synthetic Person"}),
    ("unknown", "unexpected"),
])
def test_unrequested_or_human_score_fields_get_422_before_gateway(
    tmp_path: Path, field: str, value: object,
) -> None:
    gateway = AdaptiveGateway()
    payload = body()
    payload[field] = value
    response = client(tmp_path, gateway).post(
        "/internal/v1/interview/draft", json=payload, headers=TOKEN,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "Synthetic Person" not in response.text
    assert gateway.requests == []


def test_nested_profile_and_duplicate_ids_get_422(tmp_path: Path) -> None:
    gateway = AdaptiveGateway()
    http = client(tmp_path, gateway)
    nested = body()
    nested["transcript"][1]["profile"] = {"fullName": "Synthetic Person"}
    assert http.post("/internal/v1/interview/draft", json=nested, headers=TOKEN).status_code == 422
    duplicate = body()
    duplicate["notes"] = [{"id": "iturn_01", "text": "Ambiguous"}]
    assert http.post("/internal/v1/interview/draft", json=duplicate, headers=TOKEN).status_code == 422
    assert gateway.requests == []


def test_replay_failure_uses_safe_error_envelope(tmp_path: Path) -> None:
    response = client(tmp_path, AdaptiveGateway(unavailable=True)).post(
        "/internal/v1/interview/draft", json=body(), headers=TOKEN,
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_UNAVAILABLE"
    assert "cassette" not in response.text
