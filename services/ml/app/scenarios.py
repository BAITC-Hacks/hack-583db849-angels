"""Validated, deterministic access to private scenario configuration."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError

from .schemas.contracts import ScenarioBrief, ScenarioConfig


ROOT_SCENARIOS = Path(__file__).resolve().parents[3] / "config" / "scenarios"
PACKAGED_SCENARIOS = Path(__file__).resolve().parents[1] / "scenario_data"
DEFAULT_SCENARIOS = ROOT_SCENARIOS if ROOT_SCENARIOS.is_dir() else PACKAGED_SCENARIOS


class ScenarioConfigurationError(ValueError):
    """Scenario configuration is missing, ambiguous, or internally inconsistent."""


@dataclass(frozen=True)
class ScenarioRepository:
    _scenarios: tuple[ScenarioConfig, ...]

    @classmethod
    def load(cls, directory: Path = DEFAULT_SCENARIOS) -> "ScenarioRepository":
        try:
            files = sorted(directory.glob("*.json"))
        except OSError as error:
            raise ScenarioConfigurationError(
                f"cannot read scenario directory {directory}"
            ) from error
        if not files:
            raise ScenarioConfigurationError(f"no scenarios found in {directory}")

        scenarios: list[ScenarioConfig] = []
        ids: set[str] = set()
        for path in files:
            try:
                scenario = ScenarioConfig.model_validate_json(
                    path.read_text(encoding="utf-8")
                )
            except (OSError, ValidationError, ValueError) as error:
                raise ScenarioConfigurationError(f"invalid scenario at {path}") from error
            if path.stem != scenario.scenarioId:
                raise ScenarioConfigurationError(
                    f"scenario filename does not match id at {path}"
                )
            if scenario.scenarioId in ids:
                raise ScenarioConfigurationError(
                    f"duplicate scenario id {scenario.scenarioId}"
                )
            _validate_story_graph(scenario)
            ids.add(scenario.scenarioId)
            scenarios.append(scenario)
        return cls(tuple(scenarios))

    def all(self) -> tuple[ScenarioConfig, ...]:
        return self._scenarios

    def get(self, scenario_id: str) -> ScenarioConfig | None:
        return next(
            (
                scenario
                for scenario in self._scenarios
                if scenario.scenarioId == scenario_id
            ),
            None,
        )

    def briefs(self) -> tuple[ScenarioBrief, ...]:
        return tuple(_to_brief(scenario) for scenario in self._scenarios)

    def brief(self, scenario_id: str) -> ScenarioBrief | None:
        scenario = self.get(scenario_id)
        return _to_brief(scenario) if scenario is not None else None


def _to_brief(scenario: ScenarioConfig) -> ScenarioBrief:
    return ScenarioBrief(
        scenarioId=scenario.scenarioId,
        title=scenario.title,
        situation=scenario.situation,
        yourRole=scenario.yourRole,
        goal=scenario.goal,
        character=scenario.character,
        expectedMinutes=scenario.expectedMinutes,
        maxCandidateTurns=scenario.maxCandidateTurns,
        status=scenario.status,
    )


def _validate_story_graph(scenario: ScenarioConfig) -> None:
    beats = {beat.beatId: beat for beat in scenario.beats}
    if len(beats) != len(scenario.beats):
        raise ScenarioConfigurationError(
            f"duplicate beat id in scenario {scenario.scenarioId}"
        )
    if "opening" not in beats:
        raise ScenarioConfigurationError(
            f"scenario {scenario.scenarioId} has no opening beat"
        )

    transitions: dict[str, set[str]] = {}
    has_terminal_transition = False
    for beat in scenario.beats:
        answer_ids = [answer.answerTypeId for answer in beat.answerTypes]
        if beat.fallback.answerTypeId in answer_ids or len(answer_ids) != len(
            set(answer_ids)
        ):
            raise ScenarioConfigurationError(
                f"duplicate answer type in beat {beat.beatId}"
            )
        targets = {answer.next for answer in (*beat.answerTypes, beat.fallback)}
        unknown = targets - set(beats) - {"end"}
        if unknown:
            raise ScenarioConfigurationError(
                f"unknown transition from beat {beat.beatId}: {sorted(unknown)}"
            )
        has_terminal_transition = has_terminal_transition or "end" in targets
        transitions[beat.beatId] = targets - {"end"}

    if not has_terminal_transition:
        raise ScenarioConfigurationError(
            f"scenario {scenario.scenarioId} has no terminal transition"
        )

    reachable: set[str] = set()
    pending = ["opening"]
    while pending:
        beat_id = pending.pop()
        if beat_id in reachable:
            continue
        reachable.add(beat_id)
        pending.extend(sorted(transitions[beat_id] - reachable))
    unreachable = set(beats) - reachable
    if unreachable:
        raise ScenarioConfigurationError(
            f"unreachable beats in scenario {scenario.scenarioId}: {sorted(unreachable)}"
        )


def load_scenario_repository(
    directory: Path = DEFAULT_SCENARIOS,
) -> ScenarioRepository:
    return ScenarioRepository.load(directory)
