"""What the demo's model answers cost, by task: from the recorded answers, and from gateway usage logs.

    python services/ml/scripts/budget_report.py [usage.jsonl ...]

The recorded answers in fixtures/cassettes are what replay serves. Each one
recorded live cost what its tokens or audio cost at the prices in
config/models.json; an authored one (request_id "synthetic-…") cost nothing.
Usage logs add the live calls that left no recording — trials, probes, live
runs. Neither sees calls made outside the gateway, so the providers' own
billing pages stay the total of record.
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
CASSETTES = ROOT / "fixtures" / "cassettes"
MODELS = ROOT / "config" / "models.json"
MILLION = Decimal(1_000_000)


def _price(pricing: dict, record: dict) -> Decimal:
    if pricing["unit"] == "million_tokens":
        return (
            Decimal(record.get("input_tokens") or 0) * Decimal(str(pricing["input_usd"]))
            + Decimal(record.get("output_tokens") or 0) * Decimal(str(pricing["output_usd"]))
        ) / MILLION
    return Decimal(str(record.get("billed_units") or 0)) * Decimal(str(pricing["usd"]))


def recorded_answers() -> dict[tuple[str, str], dict[str, object]]:
    """Per task and model: how many answers are authored, how many were recorded live, and what those cost."""

    pricing = {name: model["pricing"] for name, model in json.loads(MODELS.read_text(encoding="utf-8"))["models"].items()}
    table: dict[tuple[str, str], dict[str, object]] = defaultdict(lambda: {"authored": 0, "live": 0, "usd": Decimal(0)})
    for path in sorted(CASSETTES.glob("*/*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        row = table[(record.get("task") or path.parent.name, record["model"])]
        if str(record.get("request_id", "")).startswith("synthetic"):
            row["authored"] += 1
            continue
        row["live"] += 1
        row["usd"] += _price(pricing[record["model"]], record)
    return table


def logged_calls(paths: list[Path]) -> dict[tuple[str, str], dict[str, object]]:
    """Per task and model: the live calls the given gateway usage logs saw, and what they cost."""

    table: dict[tuple[str, str], dict[str, object]] = defaultdict(lambda: {"calls": 0, "usd": Decimal(0)})
    for path in paths:
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("source") != "provider":
                continue
            row = table[(record["task"], record["model"])]
            row["calls"] += 1
            row["usd"] += Decimal(str(record.get("actual_usd") or record.get("estimated_usd") or 0))
    return table


def main(argv: list[str]) -> None:
    recorded = recorded_answers()
    print("## Recorded answers (fixtures/cassettes)\n")
    print("| Task | Model | Authored | Recorded live | Cost of the live ones |")
    print("|---|---|---:|---:|---:|")
    total = Decimal(0)
    for (task, model), row in sorted(recorded.items()):
        total += row["usd"]
        print(f"| {task} | {model} | {row['authored']} | {row['live']} | ${row['usd']:.4f} |")
    print(f"| **all** | | {sum(r['authored'] for r in recorded.values())} | {sum(r['live'] for r in recorded.values())} | **${total:.4f}** |")

    if argv:
        logged = logged_calls([Path(arg) for arg in argv])
        print("\n## Live calls in the given usage logs\n")
        print("| Task | Model | Calls | Cost |")
        print("|---|---|---:|---:|")
        spent = Decimal(0)
        for (task, model), row in sorted(logged.items()):
            spent += row["usd"]
            print(f"| {task} | {model} | {row['calls']} | ${row['usd']:.4f} |")
        print(f"| **all** | | {sum(r['calls'] for r in logged.values())} | **${spent:.4f}** |")


if __name__ == "__main__":
    main(sys.argv[1:])
