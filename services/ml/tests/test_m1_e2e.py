import json
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.scripts.smoke_m1 import run


class TestClientTransport:
    __test__ = False

    def __init__(self, client: TestClient) -> None:
        self._client = client

    def request(self, method, path, *, payload=None, authenticated=True):
        headers = {"X-Internal-Token": "test-internal-token"} if authenticated else {}
        response = self._client.request(method, path, json=payload, headers=headers)
        media_type = response.headers.get("content-type", "").split(";", 1)[0]
        return response.status_code, media_type, response.content, 1.0


def test_all_six_briefs_pass_authenticated_http_smoke(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    report = run(TestClientTransport(client))
    assert report["mode"] == "replay"
    assert report["requests"] == 6
    assert len(report["cases"]) == 6
    assert sum(item["questions"] for item in report["cases"]) == 48
    assert sum(item["quotesChecked"] for item in report["cases"]) >= 48
    serialized = json.dumps(report)
    assert "test-internal-token" not in serialized
    assert "fullName" not in serialized
