import asyncio
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import BaseModel, ConfigDict

from services.ml.app.gateway.budget import GatewayBudget
from services.ml.app.gateway.cache import InMemoryResponseCache
from services.ml.app.gateway.config import (
    Provider as ProviderName,
    TaskName,
    load_models_configuration,
)
from services.ml.app.gateway.errors import GatewayBudgetError, GatewayUsageError
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import GatewayRequest, ProviderResponse
from services.ml.app.gateway.usage import FileUsageStore


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str


def request() -> GatewayRequest[Answer]:
    return GatewayRequest(
        task=TaskName.BRIEF,
        prompt="Return JSON.",
        payload={"candidateId": "candidate-a"},
        output_schema=Answer,
    )


class Provider:
    def __init__(self, gate: asyncio.Event | None = None) -> None:
        self.calls = 0
        self.gate = gate

    async def generate(self, provider_request) -> ProviderResponse:
        del provider_request
        self.calls += 1
        if self.gate is not None:
            await self.gate.wait()
        return ProviderResponse(
            content='{"value":"ok"}',
            input_tokens=12,
            output_tokens=3,
        )


class NoCassettes:
    async def load(self, *args):
        raise AssertionError("not used")

    async def save(self, *args):
        return None


class ReplayCassettes(NoCassettes):
    async def load(self, *args):
        return ProviderResponse(
            content='{"value":"replayed"}',
            input_tokens=10,
            output_tokens=2,
        )


def gateway(tmp_path: Path, provider: Provider, cap: str = "20"):
    configuration = load_models_configuration()
    store = FileUsageStore(tmp_path / "usage.jsonl")
    budget = GatewayBudget(configuration, store, Decimal(cap))
    service = ModelGateway(
        mode="live",
        configuration=configuration,
        providers={ProviderName.OPENAI: provider},
        cassettes=NoCassettes(),
        budget=budget,
    )
    return service, store


def test_provider_usage_is_costed_without_storing_content(tmp_path: Path) -> None:
    provider = Provider()
    service, store = gateway(tmp_path, provider)

    result = asyncio.run(service.execute(request()))
    records = asyncio.run(store.records())

    assert result.output.value == "ok"
    assert provider.calls == 1
    assert records[0].actual_usd == Decimal("0.000054")
    assert records[0].input_tokens == 12
    assert records[0].output_tokens == 3
    stored = store.path.read_text(encoding="utf-8")
    assert "Return JSON" not in stored
    assert "candidate-a" not in stored
    assert '"value"' not in stored


def test_request_limit_refuses_work_before_provider_call(tmp_path: Path) -> None:
    configuration = load_models_configuration()
    brief = configuration.tasks[TaskName.BRIEF].model_copy(
        update={"request_cost_limit_usd": Decimal("0.001")}
    )
    configuration = configuration.model_copy(
        update={"tasks": {**configuration.tasks, TaskName.BRIEF: brief}}
    )
    provider = Provider()
    budget = GatewayBudget(
        configuration, FileUsageStore(tmp_path / "usage.jsonl"), Decimal("20")
    )
    service = ModelGateway(
        mode="live",
        configuration=configuration,
        providers={ProviderName.OPENAI: provider},
        cassettes=NoCassettes(),
        budget=budget,
    )

    with pytest.raises(GatewayBudgetError, match="request"):
        asyncio.run(service.execute(request()))

    assert provider.calls == 0


def test_global_cap_reservation_blocks_concurrent_overspend(tmp_path: Path) -> None:
    async def scenario() -> None:
        gate = asyncio.Event()
        provider = Provider(gate)
        service, _ = gateway(tmp_path, provider, cap="0.02")
        first = asyncio.create_task(service.execute(request()))
        while provider.calls == 0:
            await asyncio.sleep(0)

        with pytest.raises(GatewayBudgetError, match="global"):
            await service.execute(request())

        gate.set()
        await first
        assert provider.calls == 1

    asyncio.run(scenario())


def test_corrupt_usage_log_blocks_live_work(tmp_path: Path) -> None:
    provider = Provider()
    service, store = gateway(tmp_path, provider)
    store.path.write_text("not-json\n", encoding="utf-8")

    with pytest.raises(GatewayUsageError, match="invalid"):
        asyncio.run(service.execute(request()))

    assert provider.calls == 0


def test_replay_and_cache_hits_are_counted_without_spend(tmp_path: Path) -> None:
    configuration = load_models_configuration()
    store = FileUsageStore(tmp_path / "usage.jsonl")
    budget = GatewayBudget(configuration, store, Decimal("0"))
    service = ModelGateway(
        mode="replay",
        configuration=configuration,
        providers={},
        cassettes=ReplayCassettes(),
        cache=InMemoryResponseCache(),
        budget=budget,
    )

    first = asyncio.run(service.execute(request()))
    second = asyncio.run(service.execute(request()))
    records = asyncio.run(store.records())

    assert first.replayed is True and first.cached is False
    assert second.replayed is True and second.cached is True
    assert [record.source for record in records] == ["replay", "cache"]
    assert all(record.actual_usd == 0 for record in records)
