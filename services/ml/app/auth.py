"""Authentication for API-to-ML calls."""

from __future__ import annotations

import hmac
from collections.abc import Callable

from fastapi import Depends
from fastapi.security import APIKeyHeader

from .errors import ServiceError


internal_token_header = APIKeyHeader(name="X-Internal-Token", auto_error=False)


def require_internal_token(token: str | None, expected: str | None) -> None:
    if token is None or expected is None or not hmac.compare_digest(token, expected):
        raise ServiceError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Missing or unknown X-Internal-Token.",
        )


def internal_auth_dependency(expected: str | None) -> Callable[..., None]:
    def authenticate(token: str | None = Depends(internal_token_header)) -> None:
        require_internal_token(token, expected)

    return authenticate
