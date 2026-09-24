"""Reusable offline A/B/C quality gate for a ready scenario's judge replay.

The expected reports are bench-only reference data. Production assessment
neither loads these files nor looks up a candidate's seed identity.
"""

from __future__ import annotations

import argparse
from decimal import Decimal
import json
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


def run_bench(
    fixture_root: Path = ROOT / "seed" / "candidates",
    scenario_id: str = "conflict-resolution",
) -> dict:
    scenario = ScenarioRepository.load().get(scenario_id)
    if scenario is None or scenario.status != "ready":
        raise BenchFailure("bench scenario must exist and be ready")
    cases = sorted(
        path for path in fixture_root.iterdir()
        if path.is_dir() and (path / "transcript.json").is_file()
    )
    if not cases:
        raise BenchFailure("no bench fixtures found")
    settings = Settings(
        ml_internal_token="bench-internal-token",
        uploads_dir=ROOT / "fixtures" / "audio",
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
        usage_log_path=ROOT / "fixtures" / "usage" / "bench.jsonl",
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
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
            raise BenchFailure(f"assessment route failed for fixture {case.name}: HTTP {response.status_code}")
        report = AssessmentResult.model_validate(response.json())
        verify_case(case, scenario_id, report, expected, turns)
        scores_checked += len(report.scores)
        quotes_checked += sum(len(score.evidence) for score in report.scores)
    return {
        "scenarioId": scenario_id,
        "cases": len(cases),
        "scoresChecked": scores_checked,
        "quotesChecked": quotes_checked,
        "mode": "replay",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture-root", type=Path, default=ROOT / "seed" / "candidates")
    parser.add_argument("--scenario-id", default="conflict-resolution")
    options = parser.parse_args()
    try:
        print(json.dumps(run_bench(options.fixture_root, options.scenario_id), sort_keys=True))
    except (BenchFailure, OSError, ValueError, KeyError) as error:
        print(f"quality bench failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
