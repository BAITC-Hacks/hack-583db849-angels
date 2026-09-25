import json
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.providers.deepgram import DeepgramProvider
from services.ml.app.providers.openai import OpenAIProvider
from services.ml.scripts.smoke_m4 import run


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


def test_synthetic_recording_replays_into_blind_draft_without_provider_network(
    tmp_path: Path,
) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=ROOT / "fixtures/audio",
        gateway_mode="replay", budget_usd_cap=Decimal("20"),
        demo_mode=False, usage_log_path=tmp_path / "usage.jsonl",
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    with (
        patch.object(DeepgramProvider, "execute", side_effect=AssertionError("STT network forbidden")),
        patch.object(OpenAIProvider, "generate", side_effect=AssertionError("LLM network forbidden")),
    ):
        report = run(TestClientTransport(client))

    assert report["mode"] == "replay"
    assert report["requests"] == 9
    assert report["turnsChecked"] == 14
    assert report["scoresChecked"] == 5
    assert report["quotesChecked"] == 4
    assert report["negativeCases"] == 6
    serialized = json.dumps(report)
    assert "test-internal-token" not in serialized
    assert "Synthetic Person" not in serialized
    assert "iturn_" not in serialized
