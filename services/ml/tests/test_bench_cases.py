import json
from pathlib import Path
import re

import pytest

from services.ml.app.metrics.languagetool import LocalLanguageTool
from services.ml.app.modules.assessment_text import ensure_safe_feedback
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.app.schemas.contracts import AssessmentResult, Turn
from services.ml.scripts import quality_bench
from services.ml.scripts.bench_cases_from_stories import BENCH, STORIES, _beats, _walkthroughs, build_case
from services.ml.scripts.quality_bench import BenchFailure, run_bench, verify_case


STORY_FILES = sorted(STORIES.glob("[0-9][0-9]-*.md"))
CASES = [
    (story, re.sub(r"^\d+-", "", story.stem), level)
    for story in STORY_FILES
    for level in ("strong", "medium", "weak")
]


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_every_story_has_three_bench_cases() -> None:
    assert len(CASES) == 27
    for _, scenario_id, level in CASES:
        folder = BENCH / scenario_id / level
        assert {path.name for path in folder.iterdir()} == {"transcript.json", "expected-assessment.json"}, folder


@pytest.mark.parametrize(("story", "scenario_id", "level"), CASES, ids=[f"{case[1]}-{case[2]}" for case in CASES])
def test_a_bench_case_is_the_story_word_for_word_and_passes_its_own_gate(story: Path, scenario_id: str, level: str) -> None:
    text = story.read_text(encoding="utf-8")
    beats = _beats(text)
    walkthrough = next(item for item in _walkthroughs(text) if item["level"] == level)
    folder = BENCH / scenario_id / level
    turns = [Turn.model_validate(item) for item in load(folder / "transcript.json")]
    expected = AssessmentResult.model_validate(load(folder / "expected-assessment.json"))

    # The candidate says exactly the walkthrough's lines, each after the character's line for that beat.
    assert [turn.text for turn in turns if turn.speaker == "candidate"] == [row[2] for row in walkthrough["rows"]]
    assert [turn.text for turn in turns if turn.speaker == "character"] == [beats[row[0]]["line"] for row in walkthrough["rows"]]
    # The reference is the story's own expected pattern.
    assert {score.competency: score.score for score in expected.scores} == walkthrough["scores"]
    # And it holds to every rule the judge is held to: verbatim quotes, a question for every null, safe feedback.
    verify_case(folder, scenario_id, expected, expected, turns)
    ensure_safe_feedback(expected.candidateFeedback)
    # The files are what the stories make today: a story edit without a rebuild fails here.
    rebuilt_turns, rebuilt = build_case(story, walkthrough, beats, scenario_id)
    assert [turn.model_dump(mode="json") for turn in rebuilt_turns] == load(folder / "transcript.json")
    assert rebuilt.model_dump(mode="json") == load(folder / "expected-assessment.json")


def test_the_bench_keeps_a_draft_whose_judge_misses_the_reference() -> None:
    # The judge's live answers for resource-crisis are recorded (#22); on its
    # medium walkthrough it leaves I without a score where the story expects 2.
    scenario = ScenarioRepository.load(ROOT_SCENARIOS).get("resource-crisis")
    assert scenario is not None and scenario.status == "draft"
    if not LocalLanguageTool()._jar.is_file():
        pytest.skip("HTTP bench needs the bundled offline LanguageTool image")
    with pytest.raises(BenchFailure, match="I is outside the reference band"):
        run_bench(scenario_id="resource-crisis")


def test_only_a_scenario_that_passes_is_promoted(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    for folder in ("config", "packaged"):
        (tmp_path / folder).mkdir()
        (tmp_path / folder / "resource-crisis.json").write_text(
            (ROOT_SCENARIOS / "resource-crisis.json").read_text(encoding="utf-8"), encoding="utf-8",
        )
    monkeypatch.setattr(quality_bench, "SCENARIOS", tmp_path / "config")
    monkeypatch.setattr(quality_bench, "PACKAGED_SCENARIOS", tmp_path / "packaged")
    monkeypatch.setattr("sys.argv", ["quality_bench.py", "--scenario-id", "resource-crisis", "--promote"])

    assert quality_bench.main() == 1
    assert load(tmp_path / "config" / "resource-crisis.json")["status"] == "draft"

    quality_bench.promote("resource-crisis")
    assert load(tmp_path / "config" / "resource-crisis.json")["status"] == "ready"
    assert load(tmp_path / "packaged" / "resource-crisis.json") == load(tmp_path / "config" / "resource-crisis.json")
