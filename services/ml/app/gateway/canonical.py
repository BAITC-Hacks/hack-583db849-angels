"""Canonical request hashing shared by cassettes, cache, and usage records."""

from __future__ import annotations

from hashlib import sha256
import json
from typing import Any

from .config import Provider
from .errors import GatewayConfigurationError
from .types import GatewayRequest


def canonical_request_bytes(
    request: GatewayRequest[Any],
    provider: Provider,
    model: str,
) -> bytes:
    try:
        serialized = json.dumps(
            {
                "provider": provider.value,
                "model": model,
                "prompt": request.prompt,
                "request": request.payload,
            },
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    except (TypeError, ValueError) as error:
        raise GatewayConfigurationError("gateway request is not canonical JSON") from error
    return serialized.encode("utf-8")


def cassette_key(
    request: GatewayRequest[Any],
    provider: Provider,
    model: str,
) -> str:
    return sha256(canonical_request_bytes(request, provider, model)).hexdigest()
