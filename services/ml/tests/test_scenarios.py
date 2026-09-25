import json
from pathlib import Path

import pytest

from services.ml.app.scenarios import (
    PACKAGED_SCENARIOS,
    ROOT_SCENARIOS,
    ScenarioConfigurationError,
    ScenarioRepository,
)


ROOT = Path(__file__).resolve().parents[3]
EXAMPLE = (
    ROOT
    / "docs"
    / "contracts"
    / "examples"
    / "candidate-a"
    / "ml"
    / "scenario-config.conflict-resolution.json"
)
def payload() -> dict[str, object]:
    return json.loads(EXAMPLE.read_text(encoding="utf-8"))


def write_scenario(directory: Path, value: dict[str, object]) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{value['scenarioId']}.json"
    target.write_text(json.dumps(value), encoding="utf-8")
    return target


def test_owned_scenario_matches_the_contract_example() -> None:
    owned = json.loads(
        (ROOT_SCENARIOS / "conflict-resolution.json").read_text(encoding="utf-8")
    )
    beats = {beat["beatId"]: beat for beat in owned["beats"]}

    assert owned == payload()
    assert owned["status"] == "ready"
    # Candidate A's five answers walk every beat, fairness included.
    assert beats["trust"]["answerTypes"][0]["next"] == "fairness"


def test_repository_returns_only_the_public_scenario_fields() -> None:
    repository = ScenarioRepository.load(ROOT_SCENARIOS)

    assert [item.scenarioId for item in repository.briefs()] == [
        "conflict-resolution"
    ]
    public = repository.brief("conflict-resolution")
    assert public is not None
    assert public.maxCandidateTurns == 8
    assert "hiddenMotive" not in public.model_dump()
    assert "voice" not in public.model_dump()
    assert "beats" not in public.model_dump()
    assert repository.brief("unknown") is None


def test_packaged_scenario_matches_the_owned_config() -> None:
    owned = json.loads(
        (ROOT_SCENARIOS / "conflict-resolution.json").read_text(encoding="utf-8")
    )
    packaged = json.loads(
        (PACKAGED_SCENARIOS / "conflict-resolution.json").read_text(encoding="utf-8")
    )

    assert packaged == owned


def test_repository_rejects_a_filename_id_mismatch(tmp_path: Path) -> None:
    scenario = payload()
    target = write_scenario(tmp_path, scenario)
    target.rename(tmp_path / "different-name.json")

    with pytest.raises(ScenarioConfigurationError, match="filename"):
        ScenarioRepository.load(tmp_path)


def test_repository_rejects_an_unknown_transition(tmp_path: Path) -> None:
    scenario = payload()
    scenario["beats"][0]["answerTypes"][0]["next"] = "missing"
    write_scenario(tmp_path, scenario)

    with pytest.raises(ScenarioConfigurationError, match="unknown transition"):
        ScenarioRepository.load(tmp_path)


def test_repository_rejects_an_unreachable_beat(tmp_path: Path) -> None:
    scenario = payload()
    for beat in scenario["beats"]:
        for answer in (*beat["answerTypes"], beat["fallback"]):
            if answer["next"] == "fairness":
                answer["next"] = "decision"
    write_scenario(tmp_path, scenario)

    with pytest.raises(ScenarioConfigurationError, match="unreachable"):
        ScenarioRepository.load(tmp_path)


def test_repository_rejects_duplicate_answer_types(tmp_path: Path) -> None:
    scenario = payload()
    scenario["beats"][0]["answerTypes"][1]["answerTypeId"] = scenario["beats"][0][
        "answerTypes"
    ][0]["answerTypeId"]
    write_scenario(tmp_path, scenario)

    with pytest.raises(ScenarioConfigurationError, match="duplicate answer type"):
        ScenarioRepository.load(tmp_path)


def test_repository_requires_a_terminal_transition(tmp_path: Path) -> None:
    scenario = payload()
    for beat in scenario["beats"]:
        for answer in (*beat["answerTypes"], beat["fallback"]):
            if answer["next"] == "end":
                answer["next"] = "opening"
    write_scenario(tmp_path, scenario)

    with pytest.raises(ScenarioConfigurationError, match="terminal transition"):
        ScenarioRepository.load(tmp_path)
