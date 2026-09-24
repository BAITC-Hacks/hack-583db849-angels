import asyncio
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.modules.assessment import AssessmentService
from services.ml.app.metrics.languagetool import LocalGrammarError
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.app.schemas.contracts import AssessmentRequest, DriveScore, Evidence, Turn


TOKEN = {"X-Internal-Token": "test-internal-token"}


class FakeJudge:
    def __init__(self) -> None:
        self.requests = []

    async def judge(self, request):
        self.requests.append(request)
        return [
            DriveScore(
                competency=code,
                score=3 if code == "D" else None,
                confidence="medium" if code == "D" else None,
                rationale="Recovery action observed." if code == "D" else None,
                evidence=[
                    Evidence(
                        source="simulation_turn", sourceId="turn_02",
                        quote="I checked the revised plan",
                    )
                ] if code == "D" else [],
            )
            for code in "DRIVE"
        ]


class FakeGrammar:
    def count_errors(self, text: str) -> int:
        assert "I checked" in text
        return 0


def request() -> AssessmentRequest:
    return AssessmentRequest(
        candidateId="synthetic-id", scenarioId="conflict-resolution", mode="voice",
        turns=[
            Turn(
                turnId="turn_01", speaker="character", text="What changed?",
                startedAt="2026-09-25T10:00:00Z", endedAt="2026-09-25T10:00:04Z",
            ),
            Turn(
                turnId="turn_02", speaker="candidate",
                text="I checked the revised plan with the team and assigned owners to each task.",
                startedAt="2026-09-25T10:00:05Z", endedAt="2026-09-25T10:00:15Z",
            ),
        ],
    )


def service() -> tuple[AssessmentService, FakeJudge]:
    judge = FakeJudge()
    return AssessmentService(
        ScenarioRepository.load(ROOT_SCENARIOS), judge, FakeGrammar(),
    ), judge


def client(tmp_path: Path) -> tuple[TestClient, FakeJudge]:
    assessment, judge = service()
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    return TestClient(
        create_app(settings, assessment_service=assessment),
        raise_server_exceptions=False,
    ), judge


def test_pipeline_returns_frozen_shape_and_null_questions() -> None:
    assessment, judge = service()
    result = asyncio.run(assessment.assess(request()))
    assert len(judge.requests) == 1
    assert [score.competency for score in result.scores] == list("DRIVE")
    assert [score.score for score in result.scores] == [3, None, None, None, None]
    assert result.english.wordsPerMinute == 84
    assert result.english.grammarErrorsPer100Words == 0
    assert [item.competency for item in result.interviewQuestions] == list("RIVE")
    assert len(result.candidateFeedback.strengths) == 1
    assert len(result.candidateFeedback.growth) == 4


def test_http_assessment_is_not_candidate_a_stub(tmp_path: Path) -> None:
    http, judge = client(tmp_path)
    response = http.post(
        "/internal/v1/simulation/assessment",
        json=request().model_dump(mode="json"), headers=TOKEN,
    )
    assert response.status_code == 200
    assert response.json()["scores"][0]["score"] == 3
    assert response.json()["scores"][1]["score"] is None
    assert len(judge.requests) == 1


def test_unknown_scenario_and_empty_transcript_fail_before_judge(tmp_path: Path) -> None:
    http, judge = client(tmp_path)
    unknown = request().model_copy(update={"scenarioId": "missing"})
    response = http.post(
        "/internal/v1/simulation/assessment",
        json=unknown.model_dump(mode="json"), headers=TOKEN,
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SCENARIO_NOT_FOUND"

    empty = request().model_copy(update={"turns": []})
    response = http.post(
        "/internal/v1/simulation/assessment",
        json=empty.model_dump(mode="json"), headers=TOKEN,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert judge.requests == []


def test_profile_field_is_rejected_at_ml_boundary(tmp_path: Path) -> None:
    http, judge = client(tmp_path)
    payload = request().model_dump(mode="json")
    payload["profile"] = {"name": "Synthetic Person"}
    response = http.post(
        "/internal/v1/simulation/assessment", json=payload, headers=TOKEN,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "Synthetic Person" not in response.text
    assert judge.requests == []


def test_duplicate_turn_ids_fail_before_judge(tmp_path: Path) -> None:
    http, judge = client(tmp_path)
    payload = request().model_dump(mode="json")
    payload["turns"][1]["turnId"] = "turn_01"
    response = http.post(
        "/internal/v1/simulation/assessment", json=payload, headers=TOKEN,
    )
    assert response.status_code == 422
    assert judge.requests == []


def test_text_accommodation_has_no_speech_metrics(tmp_path: Path) -> None:
    http, _ = client(tmp_path)
    payload = request().model_dump(mode="json")
    payload["mode"] = "text"
    response = http.post(
        "/internal/v1/simulation/assessment", json=payload, headers=TOKEN,
    )
    assert response.status_code == 200
    assert response.json()["english"]["wordsPerMinute"] is None
    assert response.json()["english"]["fillerRate"] is None


def test_language_tool_failure_is_safe_and_does_not_leak_text(tmp_path: Path) -> None:
    class FailingGrammar:
        def count_errors(self, text: str) -> int:
            raise LocalGrammarError(f"unsafe grammar details: {text}")

    judge = FakeJudge()
    assessment = AssessmentService(
        ScenarioRepository.load(ROOT_SCENARIOS), judge, FailingGrammar(),
    )
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    http = TestClient(
        create_app(settings, assessment_service=assessment),
        raise_server_exceptions=False,
    )
    response = http.post(
        "/internal/v1/simulation/assessment",
        json=request().model_dump(mode="json"), headers=TOKEN,
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_UNAVAILABLE"
    assert "I checked the revised plan" not in response.text
