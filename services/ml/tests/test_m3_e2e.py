import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.metrics.languagetool import LocalLanguageTool
from services.ml.scripts.smoke_m3 import run


ROOT = Path(__file__).resolve().parents[3]


class TestClientTransport:
    __test__ = False

    def __init__(self, client: TestClient) -> None:
        self._client = client

    def request(self, method, path, *, payload=None, authenticated=True):
        headers = {"X-Internal-Token": "test-internal-token"} if authenticated else {}
        response = self._client.request(method, path, json=payload, headers=headers)
        media_type = response.headers.get("content-type", "").split(";", 1)[0]
        return response.status_code, media_type, response.content, 1.0


def test_spoken_a_b_c_replay_into_grounded_assessment(tmp_path: Path) -> None:
    if not LocalLanguageTool()._jar.is_file():
        pytest.skip("voice-to-report integration needs bundled offline LanguageTool")
    from decimal import Decimal

    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=ROOT / "fixtures" / "audio",
        gateway_mode="replay", budget_usd_cap=Decimal("20"),
        demo_mode=False, usage_log_path=tmp_path / "usage.jsonl",
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    report = run(TestClientTransport(client))
    assert report["mode"] == "replay"
    assert report["requests"] == 57
    assert [item["candidateId"] for item in report["assessments"]] == [
        "candidate-a", "candidate-b", "candidate-c",
    ]
    assert sum(item["scoresChecked"] for item in report["assessments"]) == 15
    assert sum(item["quotesChecked"] for item in report["assessments"]) == 12
    serialized = json.dumps(report)
    assert "Timur" not in serialized
    assert "test-internal-token" not in serialized
