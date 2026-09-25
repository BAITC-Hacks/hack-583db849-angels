"""A/B/C consistency outcomes replay from request-keyed synthetic cassettes."""

import json
import socket
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.evidence import consistency_sources, verify_evidence
from services.ml.app.main import create_app
from services.ml.app.schemas.contracts import BriefResult, ConsistencyRequest, ConsistencyResult
from services.ml.scripts.build_consistency_cassettes import after_request, before_request


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed/candidates"
TOKEN = {"X-Internal-Token": "test-internal-token"}


def _client(tmp_path: Path) -> TestClient:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def _inputs(candidate: str) -> tuple[ConsistencyRequest, ConsistencyRequest]:
    before = before_request(candidate)
    saved_brief = BriefResult.model_validate_json(
        (SEED / candidate / "expected-brief.json").read_text(encoding="utf-8")
    )
    return before, after_request(
        candidate, ConsistencyResult(items=saved_brief.consistency),
    )


@pytest.mark.parametrize("candidate", list("abc"))
def test_before_and_after_replay_without_network(
    candidate: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    http = _client(tmp_path)
    before_input, after_input = _inputs(candidate)
    assert before_input == before_request(candidate)

    def forbidden_connection(*args, **kwargs):
        del args, kwargs
        raise AssertionError("replay must not open a network connection")

    with monkeypatch.context() as blocked:
        blocked.setattr(socket, "create_connection", forbidden_connection)
        before_response = http.post(
            "/internal/v1/consistency", json=before_input.model_dump(mode="json"),
            headers=TOKEN,
        )
        after_response = http.post(
            "/internal/v1/consistency", json=after_input.model_dump(mode="json"),
            headers=TOKEN,
        )

    assert before_response.status_code == 200
    assert after_response.status_code == 200
    before = ConsistencyResult.model_validate(before_response.json())
    after = ConsistencyResult.model_validate(after_response.json())
    assert before.items[0].claim.evidence[0].sourceId == "english_self"
    assert all(item.askInInterview is None for item in after.items)
    assert [item.itemId for item in after.items[:len(after_input.beforeItems)]] == [
        item.itemId for item in after_input.beforeItems
    ]
    for item in after.items:
        sources = consistency_sources(
            after_input.candidate, after_input.simulationTurns, after_input.interviewTranscript,
        )
        for evidence in (item.claim.evidence, item.observation.evidence):
            _, submitted, dropped = verify_evidence(evidence, sources)
            assert submitted > 0 or evidence == []
            assert dropped == 0

    if candidate == "a":
        assert before.items[0].status == "discrepancy"
        assert before.items[0].claim.evidence[0].quote == "C2"
        assert before.items[0].observation.metric.value == "B2"
        assert [item.status for item in after.items] == [
            "confirmed", "confirmed", "unverified",
        ]
        assert after.items[1].observation.evidence[0].sourceId == "iturn_02"
    elif candidate == "b":
        assert [item.status for item in after.items] == ["unverified"]
        assert after.items[0].observation.metric is None
    else:
        assert [item.status for item in after.items] == ["unverified", "discrepancy"]
        assert after.items[1].itemId == "c_02"
        assert after.items[1].observation.evidence[0].sourceId == "iturn_02"


@pytest.mark.parametrize("candidate", list("abc"))
def test_fixture_inputs_are_synthetic_and_do_not_include_scores(candidate: str) -> None:
    for request in _inputs(candidate):
        raw = request.model_dump(mode="json")
        assert "profile" not in raw["candidate"]
        assert "interviewerScores" not in raw
        assert "apiKey" not in json.dumps(raw)


def test_a_empty_before_items_replays_m1_fallback(tmp_path: Path) -> None:
    http = _client(tmp_path)
    _, request = _inputs("a")
    payload = request.model_dump(mode="json")
    payload["beforeItems"] = []

    response = http.post("/internal/v1/consistency", json=payload, headers=TOKEN)

    assert response.status_code == 200
    result = ConsistencyResult.model_validate(response.json())
    assert [item.itemId for item in result.items] == ["c_01"]
    assert [item.status for item in result.items] == ["confirmed"]
    assert result.items[0].claim.evidence[0].quote == "C2"
