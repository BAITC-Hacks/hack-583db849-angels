"""Pre-call budget reservation and post-call cost accounting."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING
import json
from typing import Literal
from uuid import uuid4

from .canonical import cassette_key
from .config import ModelsConfiguration, Provider, TaskDefinition, TokenPricing
from .errors import GatewayBudgetError
from .types import GatewayRequest
from .usage import FileUsageStore, UsageRecord


MILLION = Decimal(1_000_000)


@dataclass(frozen=True)
class BudgetReservation:
    identifier: str
    estimated_usd: Decimal
    reserved_usd: Decimal


class GatewayBudget:
    def __init__(
        self,
        configuration: ModelsConfiguration,
        store: FileUsageStore,
        cap_usd: Decimal,
    ) -> None:
        self._configuration = configuration
        self._store = store
        self._cap_usd = cap_usd
        self._reservations: dict[str, Decimal] = {}
        self._lock = asyncio.Lock()

    async def reserve(self, request: GatewayRequest, model: str) -> BudgetReservation:
        task = self._configuration.tasks[request.task]
        estimated = self._estimated_cost(request, task, model)
        if estimated > task.request_cost_limit_usd:
            raise GatewayBudgetError("request exceeds its configured cost limit")

        reservation = BudgetReservation(
            identifier=uuid4().hex,
            estimated_usd=estimated,
            reserved_usd=estimated,
        )
        async with self._lock:
            spent = sum(
                (record.actual_usd for record in await self._store.records()),
                Decimal(0),
            )
            pending = sum(self._reservations.values(), Decimal(0))
            if spent + pending + reservation.reserved_usd > self._cap_usd:
                raise GatewayBudgetError("global gateway budget is exhausted")
            self._reservations[reservation.identifier] = reservation.reserved_usd
        return reservation

    async def complete(
        self,
        reservation: BudgetReservation,
        request: GatewayRequest,
        provider: Provider,
        model: str,
        mode: Literal["live", "record"],
        input_tokens: int,
        output_tokens: int,
    ) -> None:
        task = self._configuration.tasks[request.task]
        actual = self._token_cost(model, input_tokens, output_tokens)
        record = UsageRecord(
            task=request.task,
            provider=provider,
            model=model,
            mode=mode,
            source="provider",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_usd=reservation.estimated_usd,
            actual_usd=actual,
            timestamp=self._store.timestamp(),
            request_hash=cassette_key(request, provider, model),
        )
        async with self._lock:
            try:
                await self._store.append(record)
            finally:
                self._reservations.pop(reservation.identifier, None)
        if actual > task.request_cost_limit_usd:
            raise GatewayBudgetError("provider usage exceeded the request cost limit")

    async def cancel(self, reservation: BudgetReservation) -> None:
        async with self._lock:
            self._reservations.pop(reservation.identifier, None)

    async def record_free(
        self,
        request: GatewayRequest,
        provider: Provider,
        model: str,
        *,
        mode: Literal["live", "record", "replay"],
        source: Literal["replay", "cache"],
        input_tokens: int,
        output_tokens: int,
    ) -> None:
        await self._store.append(
            UsageRecord(
                task=request.task,
                provider=provider,
                model=model,
                mode=mode,
                source=source,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_usd=Decimal(0),
                actual_usd=Decimal(0),
                timestamp=self._store.timestamp(),
                request_hash=cassette_key(request, provider, model),
            )
        )

    def _estimated_cost(
        self, request: GatewayRequest, task: TaskDefinition, model: str
    ) -> Decimal:
        pricing = self._configuration.models[model].pricing
        if not isinstance(pricing, TokenPricing):
            return task.request_cost_limit_usd
        payload = json.dumps(request.payload, sort_keys=True, separators=(",", ":"))
        characters = len(request.prompt) + len(payload)
        input_tokens = Decimal(characters / 4).to_integral_value(
            rounding=ROUND_CEILING
        )
        return (
            input_tokens * pricing.input_usd
            + Decimal(task.max_tokens) * pricing.output_usd
        ) / MILLION

    def _token_cost(
        self, model: str, input_tokens: int, output_tokens: int
    ) -> Decimal:
        pricing = self._configuration.models[model].pricing
        if not isinstance(pricing, TokenPricing):
            return Decimal(0)
        return (
            Decimal(input_tokens) * pricing.input_usd
            + Decimal(output_tokens) * pricing.output_usd
        ) / MILLION
