"""Follow-up audio uses the one-speaker answer transcript route."""

from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.media import MediaGatewayResult
from services.ml.app.main import create_app


class FakeMediaGateway:
    def __init__(self):
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return MediaGatewayResult(
            content=b'{"metadata":{"duration":6.0},"results":{"utterances":[{"transcript":"We reconsidered the plan.","start":1,"end":4}]}}',
            media_type="application/json", billed_units=Decimal("0.1"),
            provider=Provider.DEEPGRAM, model="nova-3", replayed=True, cached=False,
        )


def test_follow_up_transcribes_candidate_only_and_refuses_two_speakers(tmp_path: Path) -> None:
    audio = tmp_path / "clip.wav"
    audio.write_bytes(b"synthetic-audio")
    media = FakeMediaGateway()
    client = TestClient(create_app(Settings(
        ml_internal_token="t", uploads_dir=tmp_path, gateway_mode="replay",
        budget_usd_cap=Decimal("1"), demo_mode=False, usage_log_path=tmp_path / "usage.jsonl",
    ), media_gateway=media))
    payload = {"purpose": "follow_up", "audioRef": "clip.wav", "speakers": 1}
    invalid = client.post("/internal/v1/transcribe", json={**payload, "speakers": 2}, headers={"X-Internal-Token": "t"})
    assert invalid.status_code == 422
    assert media.requests == []
    response = client.post("/internal/v1/transcribe", json=payload, headers={"X-Internal-Token": "t"})
    assert response.status_code == 200
    assert response.json()["turns"] == [{"speaker": "candidate", "text": "We reconsidered the plan.", "startSec": 1.0, "endSec": 4.0}]
    assert media.requests[0].parameters == {"language": "en", "speakers": 1, "purpose": "follow_up"}
    assert media.requests[0].estimated_units == Decimal(2)
