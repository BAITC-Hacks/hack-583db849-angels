"""Offline HTTP smoke for C before/after; prints no candidate text."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from time import perf_counter


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.schemas.contracts import BriefResult, ConsistencyResult
from services.ml.scripts.build_consistency_cassettes import after_request, before_request


SEED = ROOT / "seed/candidates"
TOKEN = {"X-Internal-Token": "synthetic-smoke-token"}


def run() -> None:
    with TemporaryDirectory(prefix="consistency-smoke-") as temporary:
        temp_path = Path(temporary)
        settings = Settings(
            ml_internal_token="synthetic-smoke-token",
            uploads_dir=temp_path, gateway_mode="replay",
            budget_usd_cap=Decimal("20"), demo_mode=False,
            usage_log_path=temp_path / "usage.jsonl",
        )
        http = TestClient(create_app(settings), raise_server_exceptions=False)
        for candidate in "abc":
            brief = BriefResult.model_validate_json(
                (SEED / candidate / "expected-brief.json").read_text(encoding="utf-8")
            )
            requests = (
                before_request(candidate),
                after_request(candidate, ConsistencyResult(items=brief.consistency)),
            )
            for request in requests:
                started = perf_counter()
                response = http.post(
                    "/internal/v1/consistency", json=request.model_dump(mode="json"),
                    headers=TOKEN,
                )
                if response.status_code != 200:
                    raise RuntimeError(
                        f"consistency smoke failed candidate={candidate} stage={request.stage} "
                        f"status={response.status_code}"
                    )
                result = ConsistencyResult.model_validate(response.json())
                elapsed_ms = (perf_counter() - started) * 1000
                print(f"candidate={candidate} stage={request.stage} "
                      f"items={len(result.items)} latency_ms={elapsed_ms:.1f}")


if __name__ == "__main__":
    run()
