"""The quality gate a scenario passes before it becomes `ready`.

For each of a scenario's three reference walkthroughs (strong, medium, weak)
the judge writes its own report on the same transcript; the gate holds when
every score lands within ±1 of the reference — a reference `null` must stay
`null` — every quote is verbatim, every `null` has a live-interview question
and the candidate feedback is safe.

Cases live in fixtures/bench/<scenario-id>/ (made from the stories by
bench_cases_from_stories.py); the first scenario's are the seed candidates.
The expected reports are bench-only reference data: production assessment
neither loads them nor looks up a candidate's seed identity.

    # offline, from recorded judge answers
    python services/ml/scripts/quality_bench.py --scenario-id resource-crisis
    # once, live: records the judge's answers and promotes what passes
    GATEWAY_MODE=record python services/ml/scripts/quality_bench.py --all --mode record --promote
"""

from __future__ import annotations

import argparse
from decimal import Decimal
import json
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.evidence import candidate_turn_sources, verify_evidence
from services.ml.app.main import create_app
from services.ml.app.modules.assessment_text import ensure_safe_feedback
from services.ml.app.scenarios import ScenarioRepository
from services.ml.app.schemas.contracts import (
    AssessmentRequest, AssessmentResult, CandidateFeedback, Turn,
)


class BenchFailure(AssertionError):
    """A reference walkthrough failed a quality or grounding condition."""


def _read(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def verify_case(
    case: Path,
    scenario_id: str,
    report: AssessmentResult,
    expected: AssessmentResult,
    turns: list[Turn],
) -> None:
    session_path = case / "m2a-session.json"
    if session_path.is_file():
        session = _read(session_path)
        if session["scenarioId"] != scenario_id or [
            item["text"] for item in session["turns"]
        ] != [turn.text for turn in turns if turn.speaker == "candidate"]:
            raise BenchFailure("spoken session differs from assessment transcript")

    sources = candidate_turn_sources(turns)
    for actual, reference in zip(report.scores, expected.scores, strict=True):
        if actual.competency != reference.competency:
            raise BenchFailure("competency order changed")
        if reference.score is None:
            if actual.score is not None:
                raise BenchFailure(f"{actual.competency} must remain null")
        elif actual.score is None or abs(actual.score - reference.score) > 1:
            raise BenchFailure(f"{actual.competency} is outside the reference band")
        accepted, submitted, dropped = verify_evidence(actual.evidence, sources)
        if dropped or submitted != len(accepted):
            raise BenchFailure(f"{actual.competency} has an unverified quote")
        if actual.score is not None and not accepted:
            raise BenchFailure(f"{actual.competency} lacks evidence")

    for reference in expected.scores:
        _, _, dropped = verify_evidence(reference.evidence, sources)
        if dropped:
            raise BenchFailure("expected report quotes a line outside the transcript")
    missing = {score.competency for score in report.scores if score.score is None}
    questioned = {item.competency for item in report.interviewQuestions}
    if not missing.issubset(questioned):
        raise BenchFailure("a null competency lacks a live interview question")
    try:
        ensure_safe_feedback(report.candidateFeedback)
    except ValueError as error:
        raise BenchFailure("unsafe candidate feedback") from error


SEED_CASES = ROOT / "seed" / "candidates"
BENCH_CASES = ROOT / "fixtures" / "bench"
SCENARIOS = ROOT / "config" / "scenarios"
PACKAGED_SCENARIOS = ROOT / "services" / "ml" / "scenario_data"


def cases_for(scenario_id: str) -> Path:
    """A scenario's own bench cases, or the seed candidates for the first scenario."""
    own = BENCH_CASES / scenario_id
    return own if own.is_dir() else SEED_CASES


def run_bench(
    fixture_root: Path | None = None,
    scenario_id: str = "conflict-resolution",
    mode: str = "replay",
) -> dict:
    # A draft is exactly what the bench is for: it decides whether it may become ready.
    if ScenarioRepository.load().get(scenario_id) is None:
        raise BenchFailure(f"scenario {scenario_id} does not exist")
    if mode not in {"replay", "record"}:
        raise BenchFailure("the bench runs in replay, or in record for its one live run")
    fixture_root = fixture_root or cases_for(scenario_id)
    cases = sorted(
        path for path in fixture_root.iterdir()
        if path.is_dir() and (path / "transcript.json").is_file()
    )
    if not cases:
        raise BenchFailure("no bench fixtures found")
    settings = Settings(
        ml_internal_token="bench-internal-token",
        uploads_dir=ROOT / "fixtures" / "audio",
        gateway_mode=mode,
        budget_usd_cap=Decimal(os.environ.get("BUDGET_USD_CAP", "20")),
        demo_mode=False,
        usage_log_path=ROOT / "fixtures" / "usage" / "bench.jsonl",
    )
    # One event loop for every case. Without the context manager each request
    # runs in a new loop, the OpenAI client made in the first one fails in the
    # next, and the gateway quietly falls back to the second model: a live run
    # would judge the first case with gpt-6-sol and the rest with gpt-6-luna.
    with TestClient(create_app(settings), raise_server_exceptions=False) as client:
        return _judge_cases(client, cases, scenario_id, mode)


def _judge_cases(client: TestClient, cases: list[Path], scenario_id: str, mode: str) -> dict[str, object]:
    scores_checked = 0
    quotes_checked = 0
    for case in cases:
        turns = [Turn.model_validate(item) for item in _read(case / "transcript.json")]
        expected = AssessmentResult.model_validate(_read(case / "expected-assessment.json"))
        request = AssessmentRequest(
            candidateId=f"synthetic-{case.name}", scenarioId=scenario_id,
            mode="voice", turns=turns,
        )
        response = client.post(
            "/internal/v1/simulation/assessment",
            headers={"X-Internal-Token": "bench-internal-token"},
            json=request.model_dump(mode="json"),
        )
        if response.status_code != 200:
            hint = " (no recorded judge answer — run it once with --mode record — or no local LanguageTool)" if mode == "replay" and response.status_code == 503 else ""
            raise BenchFailure(f"assessment route failed for fixture {case.name}: HTTP {response.status_code}{hint}")
        report = AssessmentResult.model_validate(response.json())
        verify_case(case, scenario_id, report, expected, turns)
        scores_checked += len(report.scores)
        quotes_checked += sum(len(score.evidence) for score in report.scores)
    return {
        "scenarioId": scenario_id,
        "cases": len(cases),
        "scoresChecked": scores_checked,
        "quotesChecked": quotes_checked,
        "mode": mode,
    }


def promote(scenario_id: str) -> None:
    """Marks a scenario that passed as ready, in the config and in the service's packaged copy."""
    for directory in (SCENARIOS, PACKAGED_SCENARIOS):
        path = directory / f"{scenario_id}.json"
        config = json.loads(path.read_text(encoding="utf-8"))
        config["status"] = "ready"
        path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture-root", type=Path)
    parser.add_argument("--scenario-id", default="conflict-resolution")
    parser.add_argument("--all", action="store_true", help="every scenario that has bench cases")
    parser.add_argument("--mode", choices=["replay", "record"], default="replay")
    parser.add_argument("--promote", action="store_true", help="mark every scenario that passes as ready")
    options = parser.parse_args()
    if options.all:
        scenario_ids = ["conflict-resolution", *sorted(path.name for path in BENCH_CASES.iterdir() if path.is_dir())]
    else:
        scenario_ids = [options.scenario_id]
    failed = 0
    repository = ScenarioRepository.load()
    for scenario_id in scenario_ids:
        scenario = repository.get(scenario_id)
        if options.mode == "record" and scenario is not None and scenario.status == "ready":
            # A ready scenario already has its recorded judge answers; recording again would only spend money.
            print(json.dumps({"scenarioId": scenario_id, "skipped": "already ready"}))
            continue
        try:
            report = run_bench(options.fixture_root if not options.all else None, scenario_id, options.mode)
        except (BenchFailure, OSError, ValueError, KeyError) as error:
            failed += 1
            print(f"{scenario_id}: quality bench failed: {error}", file=sys.stderr)
            continue
        if options.promote:
            promote(scenario_id)
            report["promoted"] = True
        print(json.dumps(report, sort_keys=True))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
