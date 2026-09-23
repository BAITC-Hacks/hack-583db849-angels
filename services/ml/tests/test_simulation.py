import asyncio
from decimal import Decimal
import logging
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.gateway.errors import GatewayProviderError
from services.ml.app.main import create_app
from services.ml.app.modules.director import ScenarioDirector
from services.ml.app.modules.matcher import MatchResult
from services.ml.app.modules.simulation import SimulationService
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.app.schemas.contracts import Turn, TurnRequest, TurnState


TOKEN = {"X-Internal-Token": "test-internal-token"}


class FirstBranchMatcher:
    def match(self, scenario, beat_id: str, candidate_text: str) -> MatchResult:
        del candidate_text
        beat = next(item for item in scenario.beats if item.beatId == beat_id)
        return MatchResult(
            answer_type=beat.answerTypes[0],
            similarity=0.9,
            used_fallback=False,
        )


class SyntheticActor:
    def __init__(self) -> None:
        self.calls = []

    async def generate(self, scenario, outcome, turns) -> str:
        self.calls.append((scenario.scenarioId, outcome, list(turns)))
        return f"Synthetic line for {outcome.decision.nextBeat}."


class FailingActor:
    async def generate(self, scenario, outcome, turns) -> str:
        del scenario, outcome, turns
        raise GatewayProviderError("unsafe provider details")


def candidate_turn(number: int, text: str = "safe synthetic response") -> Turn:
    return Turn(
        turnId=f"turn_{number:02d}",
        speaker="candidate",
        text=text,
        startedAt="2026-09-25T10:00:00Z",
        endedAt="2026-09-25T10:00:10Z",
    )


def service(actor=None) -> SimulationService:
    return SimulationService(
        ScenarioRepository.load(ROOT_SCENARIOS),
        ScenarioDirector(FirstBranchMatcher()),
        actor or SyntheticActor(),
    )


def settings(tmp_path: Path) -> Settings:
    return Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )


def test_complete_stateless_path_reaches_finished() -> None:
    simulation = service()
    opening = asyncio.run(
        simulation.turn(TurnRequest(scenarioId="conflict-resolution", turns=[]))
    )
    assert opening.stage == "opening"
    assert opening.director.nextBeat == "opening"

    next_beat = opening.director.nextBeat
    candidates = []
    stages = []
    result = opening
    while not result.ended:
        candidates.append(candidate_turn(len(candidates) + 1))
        result = asyncio.run(
            simulation.turn(
                TurnRequest(
                    scenarioId="conflict-resolution",
                    turns=candidates,
                    state=TurnState(
                        beat=next_beat,
                        candidateTurns=len(candidates),
                    ),
                )
            )
        )
        stages.append(result.stage)
        next_beat = result.director.nextBeat

    assert stages == ["in-progress", "in-progress", "wrapping-up", "finished"]
    assert result.director.nextBeat == "end"
    assert len(candidates) == 4


def test_real_http_route_uses_pipeline_and_returns_contract_shape(tmp_path: Path) -> None:
    client = TestClient(
        create_app(settings(tmp_path), simulation_service=service()),
        raise_server_exceptions=False,
    )

    response = client.post(
        "/internal/v1/simulation/turn",
        json={"scenarioId": "conflict-resolution", "turns": []},
        headers=TOKEN,
    )

    assert response.status_code == 200
    assert response.json()["stage"] == "opening"
    assert response.json()["director"]["nextBeat"] == "opening"


def test_malformed_state_returns_safe_validation_error(tmp_path: Path) -> None:
    client = TestClient(
        create_app(settings(tmp_path), simulation_service=service()),
        raise_server_exceptions=False,
    )
    payload = {
        "scenarioId": "conflict-resolution",
        "turns": [candidate_turn(1).model_dump(mode="json")],
        "state": {"beat": "opening", "candidateTurns": 2},
    }

    response = client.post(
        "/internal/v1/simulation/turn", json=payload, headers=TOKEN
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "count" not in response.text


def test_unknown_scenario_and_provider_failure_use_safe_http_errors(tmp_path: Path) -> None:
    client = TestClient(
        create_app(settings(tmp_path), simulation_service=service()),
        raise_server_exceptions=False,
    )
    missing = client.post(
        "/internal/v1/simulation/turn",
        json={"scenarioId": "missing", "turns": []},
        headers=TOKEN,
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "SCENARIO_NOT_FOUND"

    failing = TestClient(
        create_app(
            settings(tmp_path),
            simulation_service=service(FailingActor()),
        ),
        raise_server_exceptions=False,
    ).post(
        "/internal/v1/simulation/turn",
        json={"scenarioId": "conflict-resolution", "turns": []},
        headers=TOKEN,
    )
    assert failing.status_code == 503
    assert failing.json()["error"]["code"] == "AI_UNAVAILABLE"
    assert "unsafe provider details" not in failing.text


def test_pipeline_logs_timings_and_decision_without_transcript(caplog) -> None:
    marker = "NEVER_LOG_PIPELINE_TRANSCRIPT"
    request = TurnRequest(
        scenarioId="conflict-resolution",
        turns=[candidate_turn(1, marker)],
        state=TurnState(beat="opening", candidateTurns=1),
    )

    with caplog.at_level(logging.INFO):
        asyncio.run(service().turn(request))

    assert "scenario_director_decision" in caplog.text
    assert "simulation_turn_completed" in caplog.text
    assert marker not in caplog.text
    completion = next(
        record
        for record in caplog.records
        if record.message == "simulation_turn_completed"
    )
    assert completion.director_ms >= 0
    assert completion.actor_ms >= 0
    assert completion.total_ms >= 0
