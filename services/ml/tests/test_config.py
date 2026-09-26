from decimal import Decimal
from pathlib import Path

import pytest

from services.ml.app.config import load_settings


def test_settings_use_safe_replay_defaults() -> None:
    settings = load_settings({})

    assert settings.gateway_mode == "replay"
    assert settings.budget_usd_cap == Decimal("20")
    assert settings.uploads_dir == Path("/data/uploads")
    assert settings.demo_mode is False


def test_settings_hide_the_internal_token_from_repr() -> None:
    settings = load_settings({"ML_INTERNAL_TOKEN": "do-not-print-this"})

    assert "do-not-print-this" not in repr(settings)


@pytest.mark.parametrize(
    ("environment", "message"),
    [
        ({"GATEWAY_MODE": "unknown"}, "GATEWAY_MODE"),
        ({"BUDGET_USD_CAP": "not-a-number"}, "BUDGET_USD_CAP"),
        ({"BUDGET_USD_CAP": "-1"}, "BUDGET_USD_CAP"),
        ({"DEMO_MODE": "sometimes"}, "DEMO_MODE"),
    ],
)
def test_settings_reject_invalid_values(environment: dict[str, str], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        load_settings(environment)


def test_speech_and_transcription_can_run_in_their_own_mode() -> None:
    assert load_settings({}).media_mode == "replay"
    assert load_settings({"GATEWAY_MODE": "live"}).media_mode == "live"
    mixed = load_settings({"GATEWAY_MODE": "replay", "MEDIA_GATEWAY_MODE": "live"})
    assert (mixed.gateway_mode, mixed.media_mode) == ("replay", "live")
    assert load_settings({"MEDIA_GATEWAY_MODE": " "}).media_mode == "replay"
    with pytest.raises(ValueError, match="MEDIA_GATEWAY_MODE"):
        load_settings({"MEDIA_GATEWAY_MODE": "sometimes"})
