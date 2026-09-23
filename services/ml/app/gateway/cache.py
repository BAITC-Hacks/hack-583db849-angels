"""Small in-memory TTL cache keyed by the canonical cassette identity."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from time import monotonic
from typing import Any

from .canonical import cassette_key
from .config import Provider
from .types import GatewayRequest, ProviderResponse


@dataclass(frozen=True)
class CacheEntry:
    response: ProviderResponse
    expires_at: float


class InMemoryResponseCache:
    def __init__(self, *, clock: Callable[[], float] = monotonic) -> None:
        self._clock = clock
        self._entries: dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()

    async def get(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
    ) -> ProviderResponse | None:
        key = cassette_key(request, provider, model)
        async with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= self._clock():
                del self._entries[key]
                return None
            return entry.response

    async def put(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
        response: ProviderResponse,
        ttl_seconds: int,
    ) -> None:
        key = cassette_key(request, provider, model)
        async with self._lock:
            self._entries[key] = CacheEntry(
                response=response,
                expires_at=self._clock() + ttl_seconds,
            )


class NullResponseCache:
    async def get(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
    ) -> ProviderResponse | None:
        del request, provider, model
        return None

    async def put(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
        response: ProviderResponse,
        ttl_seconds: int,
    ) -> None:
        del request, provider, model, response, ttl_seconds
