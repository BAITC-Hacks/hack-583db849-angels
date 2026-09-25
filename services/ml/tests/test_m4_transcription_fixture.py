"""The synthetic interview recording must stay aligned with its offline cassette."""

import base64
from decimal import Decimal
from hashlib import sha256
import json
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.media import FileMediaCassetteStore, MediaRequest
from services.ml.app.main import create_app
from services.ml.app.providers.deepgram import DeepgramProvider
from services.ml.app.schemas.contracts import InterviewTurn, TranscribeResult


ROOT = Path(__file__).resolve().parents[3]
AUDIO_ROOT = ROOT / "fixtures/audio"
AUDIO = AUDIO_ROOT / "interview/candidate-a.ogg"
SEED = ROOT / "seed/candidates/a/interview-transcript.json"
EXAMPLE = ROOT / "docs/contracts/examples/candidate-a/ml/transcribe.response.json"
TOKEN = {"X-Internal-Token": "test-internal-token"}


def test_interview_audio_and_cassette_key_are_consistent() -> None:
    audio = AUDIO.read_bytes()
    assert audio.startswith(b"OggS")
    assert len(audio) > 100_000
    assert sha256(audio).hexdigest() == "ed39313ff1bf246de4ac9dba459360ed4081871275f1a89505b9609bded57b0b"
    request = MediaRequest(
        task=TaskName.TRANSCRIPTION, operation="transcribe", content=audio,
        content_type="audio/ogg",
        parameters={"language": "en", "speakers": 2, "purpose": "interview",
                    "diarize_model": "latest"},
        estimated_units=Decimal(60),
    )
    cassette = FileMediaCassetteStore(ROOT / "fixtures/cassettes").path_for(
        request, Provider.DEEPGRAM, "nova-3",
    )
    assert cassette.is_file()
    envelope = json.loads(cassette.read_text(encoding="utf-8"))
    assert envelope["request_hash"] == cassette.stem
    assert envelope["request_id"] == "synthetic-m4-interview"
    assert base64.b64encode(audio).decode("ascii") not in cassette.read_text(encoding="utf-8")


def test_candidate_a_interview_replays_without_provider_network(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=AUDIO_ROOT,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    with patch.object(DeepgramProvider, "execute", side_effect=AssertionError("provider forbidden")):
        response = client.post("/internal/v1/transcribe", json={
            "purpose": "interview", "audioRef": "interview/candidate-a.ogg",
            "language": "en", "speakers": 2,
        }, headers=TOKEN)

    assert response.status_code == 200
    result = TranscribeResult.model_validate(response.json())
    example = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    assert result.durationSec == example["durationSec"]
    assert len(result.turns) == len(example["turns"]) == len(seed) == 14
    assert {turn.speaker for turn in result.turns} == {"interviewer", "candidate"}
    assert all(turn.confidence == 0.98 for turn in result.turns)
    assert all(item["speaker"] == "candidate" for item in seed[1::2])
    assert all(item["speaker"] == "interviewer" for item in seed[::2])
    for number, (observed, contract, item) in enumerate(
        zip(result.turns, example["turns"], seed, strict=True), start=1,
    ):
        assert observed.model_dump(exclude={"confidence"}) == contract
        assert item == {"turnId": f"iturn_{number:02d}", **contract}
        InterviewTurn.model_validate(item)
