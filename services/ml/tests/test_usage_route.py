import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.usage import FileUsageStore, UsageRecord
from services.ml.app.main import create_app


TOKEN = {"X-Internal-Token": "test-internal-token"}


def record(source: str, cost: str, mode: str = "live") -> UsageRecord:
    return UsageRecord(
        task=TaskName.BRIEF,
        provider=Provider.OPENAI,
        model="gpt-6-sol",
        mode=mode,
        source=source,
        input_tokens=12,
        output_tokens=3,
        estimated_usd=Decimal(cost),
        actual_usd=Decimal(cost),
        timestamp=datetime(2026, 9, 23, tzinfo=timezone.utc),
        request_hash="a" * 64,
    )


def test_usage_aggregates_provider_replay_and_cache_events(tmp_path: Path) -> None:
    path = tmp_path / "usage.jsonl"
    store = FileUsageStore(path)
    asyncio.run(store.append(record("provider", "0.0000001")))
    asyncio.run(store.append(record("provider", "0.0000001", "record")))
    asyncio.run(store.append(record("replay", "0", "replay")))
    asyncio.run(store.append(record("cache", "0", "replay")))
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
        usage_log_path=path,
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)

    response = client.get("/internal/v1/usage", headers=TOKEN)

    assert response.status_code == 200
    assert response.json() == {
        "gatewayMode": "replay",
        "liveCalls": 2,
        "replayedCalls": 2,
        "spentUsd": 0.000001,
        "capUsd": 20.0,
    }


def test_usage_route_requires_the_internal_token(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)

    response = client.get("/internal/v1/usage")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_corrupt_usage_log_fails_without_reporting_zero_spend(tmp_path: Path) -> None:
    path = tmp_path / "usage.jsonl"
    path.write_text("not-json\n", encoding="utf-8")
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="live",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
        usage_log_path=path,
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)

    response = client.get("/internal/v1/usage", headers=TOKEN)

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "not-json" not in response.text
