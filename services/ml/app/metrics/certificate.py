"""Indicative, local certificate-to-CEFR mapping for consistency signals."""

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from pathlib import Path


ROOT_MAP = Path(__file__).resolve().parents[4] / "config/english_map.json"
PACKAGED_MAP = Path(__file__).resolve().parents[2] / "stub_data/english_map.json"
DEFAULT_MAP = ROOT_MAP if ROOT_MAP.is_file() else PACKAGED_MAP
_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}


@lru_cache
def load_english_map(path: Path = DEFAULT_MAP) -> dict[str, dict[str, str]]:
    """Reject malformed policy data at load time rather than guessing."""

    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("version") != 1 or not isinstance(payload.get("certificates"), dict):
        raise ValueError("invalid English certificate map version or shape")
    certificates = payload["certificates"]
    for bands in certificates.values():
        if not isinstance(bands, dict) or any(level not in _LEVELS for level in bands.values()):
            raise ValueError("invalid English certificate map bands")
    return certificates


def mapped_certificate_cefr(certificate_type: str, score: str) -> str | None:
    """Interpret a supplied overall band, never verify the certificate."""

    bands = load_english_map().get(certificate_type.strip().upper())
    if bands is None:
        return None
    try:
        value = Decimal(score.strip())
    except (InvalidOperation, AttributeError):
        return None
    if not value.is_finite():
        return None
    return bands.get(str(value.normalize()))
