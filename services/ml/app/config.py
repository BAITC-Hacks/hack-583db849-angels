"""Environment-backed ML service settings without secret values in source control."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Literal, Mapping
import os


GatewayMode = Literal["live", "record", "replay"]


@dataclass(frozen=True)
class Settings:
    ml_internal_token: str | None = field(repr=False)
    uploads_dir: Path
    gateway_mode: GatewayMode
    budget_usd_cap: Decimal
    demo_mode: bool
    usage_log_path: Path = Path("/data/gateway-usage.jsonl")
    # Speech and transcription (Deepgram) on their own: live speech while model
    # answers replay, say. None follows gateway_mode.
    media_gateway_mode: GatewayMode | None = None

    @property
    def media_mode(self) -> GatewayMode:
        return self.media_gateway_mode or self.gateway_mode


def _boolean(value: str, name: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean")


def load_settings(environment: Mapping[str, str] | None = None) -> Settings:
    values = os.environ if environment is None else environment
    gateway_mode = values.get("GATEWAY_MODE", "replay")
    if gateway_mode not in {"live", "record", "replay"}:
        raise ValueError("GATEWAY_MODE must be live, record, or replay")

    media_gateway_mode = values.get("MEDIA_GATEWAY_MODE", "").strip() or None
    if media_gateway_mode not in {None, "live", "record", "replay"}:
        raise ValueError("MEDIA_GATEWAY_MODE must be live, record, replay, or empty")

    try:
        budget_usd_cap = Decimal(values.get("BUDGET_USD_CAP", "20"))
    except InvalidOperation as error:
        raise ValueError("BUDGET_USD_CAP must be a decimal number") from error
    if not budget_usd_cap.is_finite() or budget_usd_cap < 0:
        raise ValueError("BUDGET_USD_CAP must be a finite non-negative number")

    return Settings(
        ml_internal_token=values.get("ML_INTERNAL_TOKEN"),
        uploads_dir=Path(values.get("UPLOADS_DIR", "/data/uploads")),
        gateway_mode=gateway_mode,
        budget_usd_cap=budget_usd_cap,
        demo_mode=_boolean(values.get("DEMO_MODE", "false"), "DEMO_MODE"),
        usage_log_path=Path(
            values.get("USAGE_LOG_PATH", "/data/gateway-usage.jsonl")
        ),
        media_gateway_mode=media_gateway_mode,
    )
