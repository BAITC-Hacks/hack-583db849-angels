import pytest
from pydantic import ValidationError

from services.ml.app.auth import require_internal_token
from services.ml.app.errors import ServiceError
from services.ml.app.main import build_app
from services.ml.app.schemas.contracts import CandidateView


def test_internal_token_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_INTERNAL_TOKEN", "test-internal-token")

    require_internal_token("test-internal-token", "test-internal-token")

    with pytest.raises(ServiceError) as missing:
        require_internal_token(None, "test-internal-token")
    assert missing.value.status_code == 401

    with pytest.raises(ServiceError) as unknown:
        require_internal_token("wrong-token", "test-internal-token")
    assert unknown.value.status_code == 401


def test_f0_openapi_exposes_the_routes_used_by_the_api_adapter() -> None:
    paths = build_app().openapi()["paths"]

    assert {
        "/internal/v1/health",
        "/internal/v1/scenarios",
        "/internal/v1/scenarios/{scenarioId}",
        "/internal/v1/simulation/turn",
        "/internal/v1/simulation/assessment",
        "/internal/v1/brief",
        "/internal/v1/transcribe",
        "/internal/v1/speech",
        "/internal/v1/consistency",
        "/internal/v1/surprise-question",
        "/internal/v1/usage",
        "/internal/v1/interview/draft",
        "/internal/v1/quality-check",
    }.issubset(paths)


def test_openapi_marks_only_non_health_routes_as_protected() -> None:
    paths = build_app().openapi()["paths"]

    assert "security" not in paths["/internal/v1/health"]["get"]
    assert paths["/internal/v1/simulation/turn"]["post"]["security"] == [
        {"APIKeyHeader": []}
    ]


def test_candidate_view_rejects_profile_fields() -> None:
    with pytest.raises(ValidationError):
        CandidateView.model_validate(
            {
                "candidateId": "candidate-a",
                "application": {"answers": []},
                "test": {"answers": []},
                "profile": {"name": "Synthetic Candidate"},
            }
        )
