import json
from pathlib import Path

import pytest

from services.ml.app.metrics.languagetool import LocalLanguageTool
from services.ml.app.schemas.contracts import AssessmentResult, Evidence, Turn
from services.ml.app.gateway.cassettes import CassetteEnvelope
from services.ml.app.gateway.config import TaskName
from services.ml.app.modules.judge import JudgeOutput
from services.ml.scripts.quality_bench import BenchFailure, run_bench, verify_case


ROOT = Path(__file__).resolve().parents[3]
CASE = ROOT / "seed" / "candidates" / "a"


def fixtures():
    report = AssessmentResult.model_validate_json(
        (CASE / "expected-assessment.json").read_text(encoding="utf-8")
    )
    turns = [
        Turn.model_validate(item)
        for item in json.loads(
            (CASE / "transcript.json").read_text(encoding="utf-8")
        )
    ]
    return report, turns


def test_valid_reference_report_passes() -> None:
    report, turns = fixtures()
    verify_case(CASE, "conflict-resolution", report, report, turns)


def test_wrong_score_band_is_rejected() -> None:
    expected, turns = fixtures()
    report = expected.model_copy(deep=True)
    report.scores[0].score = 4
    with pytest.raises(BenchFailure, match="outside the reference band"):
        verify_case(CASE, "conflict-resolution", report, expected, turns)


def test_fabricated_quote_is_rejected() -> None:
    expected, turns = fixtures()
    report = expected.model_copy(deep=True)
    report.scores[0].evidence = [
        Evidence(source="simulation_turn", sourceId="turn_10", quote="Never said this")
    ]
    with pytest.raises(BenchFailure, match="unverified quote"):
        verify_case(CASE, "conflict-resolution", report, expected, turns)


def test_missing_question_and_unsafe_feedback_are_rejected() -> None:
    expected, turns = fixtures()
    report = expected.model_copy(deep=True)
    report.interviewQuestions = []
    with pytest.raises(BenchFailure, match="lacks a live interview question"):
        verify_case(CASE, "conflict-resolution", report, expected, turns)
    report = expected.model_copy(deep=True)
    report.candidateFeedback.strengths = ["Your score is 4"]
    with pytest.raises(BenchFailure, match="unsafe candidate feedback"):
        verify_case(CASE, "conflict-resolution", report, expected, turns)


def test_changed_spoken_session_or_transcript_is_rejected(tmp_path: Path) -> None:
    expected, turns = fixtures()
    local_case = tmp_path / "candidate-a"
    local_case.mkdir()
    (local_case / "m2a-session.json").write_bytes((CASE / "m2a-session.json").read_bytes())
    turns[1].text = "A completely changed candidate line."
    with pytest.raises(BenchFailure, match="spoken session differs"):
        verify_case(local_case, "conflict-resolution", expected, expected, turns)


def test_synthetic_judge_cassettes_are_schema_valid_and_do_not_contain_profile() -> None:
    files = list((ROOT / "fixtures/cassettes/simulation_assessment").glob("*.json"))
    # A, B and C, each as the seed transcript and as played by voice, are authored.
    # Turn times are not part of the key, and A's two versions say the same, so they
    # share one. The rest are the judge's live answers to the bench walkthroughs (#22, #25).
    authored = [path for path in files if CassetteEnvelope.model_validate_json(path.read_text(encoding="utf-8")).request_id.startswith("synthetic")]
    assert len(authored) == 5
    for path in files:
        text = path.read_text(encoding="utf-8")
        envelope = CassetteEnvelope.model_validate_json(text)
        assert envelope.task == TaskName.SIMULATION_ASSESSMENT
        assert envelope.request_hash == path.stem
        assert [score.competency for score in JudgeOutput.model_validate_json(
            envelope.response
        ).scores] == list("DRIVE")
        assert '"profile"' not in text


def test_quality_bench_replays_all_three_cases_without_network() -> None:
    if not LocalLanguageTool()._jar.is_file():
        pytest.skip("HTTP bench needs the bundled offline LanguageTool image")
    report = run_bench()
    assert report == {
        "scenarioId": "conflict-resolution", "cases": 3,
        "scoresChecked": 15, "quotesChecked": 12, "mode": "replay",
    }
