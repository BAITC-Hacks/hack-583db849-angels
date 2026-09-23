"""Privacy-safe persistent usage records for gateway accounting."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
from typing import Callable, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..config import GatewayMode
from .config import Provider, TaskName
from .errors import GatewayUsageError


class UsageRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    version: Literal[1] = 1
    task: TaskName
    provider: Provider
    model: str = Field(min_length=1)
    mode: GatewayMode
    source: Literal["provider", "replay", "cache"]
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    estimated_usd: Decimal = Field(ge=0, allow_inf_nan=False)
    actual_usd: Decimal = Field(ge=0, allow_inf_nan=False)
    timestamp: datetime
    request_hash: str = Field(pattern=r"^[0-9a-f]{64}$")


class FileUsageStore:
    """Append-only JSONL storage serialized by one application-level lock."""

    def __init__(
        self,
        path: Path,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.path = path
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._lock = asyncio.Lock()

    def timestamp(self) -> datetime:
        return self._clock()

    async def records(self) -> list[UsageRecord]:
        async with self._lock:
            return self._read_unlocked()

    async def append(self, record: UsageRecord) -> None:
        line = record.model_dump_json() + "\n"
        async with self._lock:
            self._read_unlocked()
            self.path.parent.mkdir(parents=True, exist_ok=True)
            try:
                descriptor = os.open(
                    self.path,
                    os.O_APPEND | os.O_CREAT | os.O_WRONLY,
                    0o600,
                )
                with os.fdopen(descriptor, "a", encoding="utf-8") as stream:
                    stream.write(line)
                    stream.flush()
                    os.fsync(stream.fileno())
            except OSError as error:
                raise GatewayUsageError("usage log cannot be written") from error

    def _read_unlocked(self) -> list[UsageRecord]:
        if not self.path.exists():
            return []
        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()
            return [UsageRecord.model_validate_json(line) for line in lines if line]
        except (OSError, ValidationError) as error:
            raise GatewayUsageError("usage log is invalid") from error
