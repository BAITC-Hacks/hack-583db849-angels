"""M5 HTTP responses come from process input and replay, not F0 examples."""

from __future__ import annotations

from decimal import Decimal
import json
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.providers.openai import OpenAIProvider
from services.ml.app.schemas.contracts import QualityCheckResult


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
TOKEN = {"X-Internal-Token": "test-internal-token"}
ENDPOINT = "/internal/v1/quality-check"


def read(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def client(tmp_path: Path) -> TestClient:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def test_interview_finds_planted_questions_with_calculated_talk_share(tmp_path: Path) -> None:
    request = read(EXAMPLES / "quality-check-interview.request.json")
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("network forbidden")):
        response = client(tmp_path).post(ENDPOINT, json=request, headers=TOKEN)
    assert response.status_code == 200
    result = QualityCheckResult.model_validate(response.json())
    assert [signal.kind for signal in result.signals] == [
        "leading_question", "off_limits_question", "coverage_gap",
    ]
    assert [signal.evidence[0].sourceId for signal in result.signals[:2]] == [
        "iturn_03", "iturn_07",
    ]
    assert result.talkShare.interviewer == 0.35
    assert result.talkShare.candidate == 0.65
    assert result.drift == []
    assert result.interviews is None
    expected = read(EXAMPLES / "quality-check-interview.response.json")
    expected["talkShare"] = {"interviewer": 0.35, "candidate": 0.65}
    assert response.json() == expected


def test_calibration_computes_frozen_drift_in_code(tmp_path: Path) -> None:
    request = read(EXAMPLES / "quality-check-calibration.request.json")
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("network forbidden")):
        response = client(tmp_path).post(ENDPOINT, json=request, headers=TOKEN)
    assert response.status_code == 200
    result = QualityCheckResult.model_validate(response.json())
    assert result.interviews == 15
    assert result.talkShare is None
    assert [row.competency for row in result.drift] == list("DRIVE")
    assert result.drift[3].delta == 1.1
    assert [(signal.kind, signal.competencies) for signal in result.signals] == [
        ("scale_drift", ["V"]),
    ]
    assert response.json() == read(EXAMPLES / "quality-check-calibration.response.json")


def test_api_demo_panel_has_planted_values_drift(tmp_path: Path) -> None:
    request = {
        "kind": "calibration", "interviewerRef": "synthetic-interviewer-a",
        "periodFrom": "2026-09-01", "periodTo": "2026-10-01",
        "history": read(ROOT / "seed/quality-history.json"),
    }
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("network forbidden")):
        response = client(tmp_path).post(ENDPOINT, json=request, headers=TOKEN)
    assert response.status_code == 200
    result = QualityCheckResult.model_validate(response.json())
    assert result.interviews == 6
    assert [(item.kind, item.competencies) for item in result.signals] == [
        ("scale_drift", ["V"]),
    ]
    assert next(item.delta for item in result.drift if item.competency == "V") == 1.7


def test_malformed_or_private_input_is_rejected_before_model_call(tmp_path: Path) -> None:
    request = read(EXAMPLES / "quality-check-interview.request.json")
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("network forbidden")):
        http = client(tmp_path)
        unauthorized = http.post(ENDPOINT, json=request)
        assert unauthorized.status_code == 401
        assert unauthorized.json()["error"]["code"] == "UNAUTHORIZED"

        request["candidateName"] = "Synthetic Name"
        private = http.post(ENDPOINT, json=request, headers=TOKEN)
        assert private.status_code == 422
        assert "Synthetic Name" not in private.text

        del request["candidateName"]
        request["transcript"][1]["turnId"] = request["transcript"][0]["turnId"]
        duplicate = http.post(ENDPOINT, json=request, headers=TOKEN)
        assert duplicate.status_code == 422
        assert duplicate.json()["error"]["code"] == "VALIDATION_ERROR"


def test_empty_question_side_does_not_invent_process_claims(tmp_path: Path) -> None:
    request = read(EXAMPLES / "quality-check-interview.request.json")
    request["transcript"] = [turn for turn in request["transcript"] if turn["speaker"] == "candidate"]
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("network forbidden")):
        response = client(tmp_path).post(ENDPOINT, json=request, headers=TOKEN)
    assert response.status_code == 200
    result = QualityCheckResult.model_validate(response.json())
    assert result.signals == []
    assert result.talkShare.candidate == 1.0
