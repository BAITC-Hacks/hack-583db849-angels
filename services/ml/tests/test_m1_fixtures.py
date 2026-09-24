import json
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.schemas.contracts import BriefResult
from services.ml.scripts.build_m1_cassettes import request_for
from services.ml.scripts.export_seed import brief


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed/candidates"
TOKEN = {"X-Internal-Token": "test-internal-token"}


@pytest.mark.parametrize("candidate", list("abc"))
def test_authored_expected_brief_is_deterministic(candidate: str) -> None:
    snapshot = json.loads((SEED / candidate / "snapshot.json").read_text(encoding="utf-8"))
    expected = json.loads((SEED / candidate / "expected-brief.json").read_text(encoding="utf-8"))
    assert brief(candidate, snapshot) == expected
    BriefResult.model_validate(expected)


@pytest.mark.parametrize("candidate", list("abc"))
@pytest.mark.parametrize("with_english", [True, False])
def test_six_briefs_replay_through_http(
    candidate: str, with_english: bool, tmp_path: Path,
) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    http = TestClient(create_app(settings), raise_server_exceptions=False)
    request = request_for(candidate, with_english=with_english)
    response = http.post(
        "/internal/v1/brief", json=request.model_dump(mode="json"), headers=TOKEN,
    )
    assert response.status_code == 200, response.json()
    result = BriefResult.model_validate(response.json())
    assert {question.focus for question in result.questions} == {
        "D", "R", "I", "V", "E", "invision_knowledge", "english", "motivation"
    }
    assert result.consistency[0].askInInterview
    if candidate == "a" and with_english:
        assert result.consistency[0].status == "discrepancy"
        assert result.consistency[0].claim.evidence[0].quote == "C2"
        assert result.consistency[0].observation.metric.value == "B2"
    if not with_english:
        assert result.consistency[0].observation.metric is None
    if with_english:
        expected = BriefResult.model_validate_json(
            (SEED / candidate / "expected-brief.json").read_text(encoding="utf-8")
        )
        assert result == expected
