import json
import os
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from services.ml.app.audio import resolve_audio_ref
from services.ml.app.config import Settings
from services.ml.app.errors import ServiceError
from services.ml.app.main import create_app


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
TOKEN = {"X-Internal-Token": "test-internal-token"}


def test_audio_ref_resolves_a_file_inside_uploads(tmp_path: Path) -> None:
    audio = tmp_path / "candidate-a" / "turn.webm"
    audio.parent.mkdir()
    audio.write_bytes(b"synthetic")

    assert resolve_audio_ref("candidate-a/turn.webm", tmp_path) == audio.resolve()


@pytest.mark.parametrize(
    "audio_ref",
    ["", "../escape.webm", "..\\escape.webm", "/escape.webm", "C:\\escape.webm"],
)
def test_audio_ref_rejects_empty_absolute_and_traversal_paths(
    tmp_path: Path, audio_ref: str
) -> None:
    with pytest.raises(ServiceError) as caught:
        resolve_audio_ref(audio_ref, tmp_path)

    assert caught.value.status_code == 400
    assert caught.value.code == "INVALID_AUDIO_REF"


def test_audio_ref_rejects_a_symlink_escape(tmp_path: Path) -> None:
    outside = tmp_path.parent / f"{tmp_path.name}-outside.webm"
    outside.write_bytes(b"synthetic")
    link = tmp_path / "escape.webm"
    try:
        os.symlink(outside, link)
    except OSError:
        pytest.skip("Creating symlinks is not available for this test user")

    with pytest.raises(ServiceError) as caught:
        resolve_audio_ref("escape.webm", tmp_path)

    assert caught.value.code == "INVALID_AUDIO_REF"


def test_missing_audio_ref_returns_not_found(tmp_path: Path) -> None:
    with pytest.raises(ServiceError) as caught:
        resolve_audio_ref("candidate-a/missing.webm", tmp_path)

    assert caught.value.status_code == 404
    assert caught.value.code == "AUDIO_NOT_FOUND"


def test_speech_returns_the_synthetic_mp3(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)

    response = client.post(
        "/internal/v1/speech",
        json={"text": "Synthetic speech fixture.", "voice": "demo"},
        headers=TOKEN,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == (ROOT / "fixtures" / "audio" / "silence.mp3").read_bytes()
    assert response.content


def test_transcribe_rejects_an_unsafe_reference_over_http(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    request = json.loads((EXAMPLES / "transcribe.request.json").read_text(encoding="utf-8"))
    request["audioRef"] = "../outside.webm"

    response = client.post("/internal/v1/transcribe", json=request, headers=TOKEN)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_AUDIO_REF"


def test_turn_transcription_uses_the_one_speaker_contract_example(tmp_path: Path) -> None:
    audio = tmp_path / "turns" / "synthetic" / "turn.webm"
    audio.parent.mkdir(parents=True)
    audio.write_bytes(b"synthetic-webm")
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    response = TestClient(create_app(settings), raise_server_exceptions=False).post(
        "/internal/v1/transcribe",
        json={
            "purpose": "turn",
            "audioRef": "turns/synthetic/turn.webm",
            "language": "en",
            "speakers": 1,
        },
        headers=TOKEN,
    )

    expected = json.loads(
        (EXAMPLES / "transcribe-turn.response.json").read_text(encoding="utf-8")
    )
    assert response.status_code == 200
    assert response.json() == expected
