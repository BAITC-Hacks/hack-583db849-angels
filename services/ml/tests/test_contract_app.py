import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from services.ml.app.main import build_app, require_internal_token
from services.ml.app.schemas.contracts import CandidateView


def test_internal_token_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_INTERNAL_TOKEN", "test-internal-token")

    require_internal_token("test-internal-token", "test-internal-token")

    with pytest.raises(HTTPException) as missing:
        require_internal_token(None, "test-internal-token")
    assert missing.value.status_code == 401

    with pytest.raises(HTTPException) as unknown:
        require_internal_token("wrong-token", "test-internal-token")
    assert unknown.value.status_code == 401


def test_f0_openapi_exposes_the_routes_used_by_the_api_adapter() -> None:
    paths = build_app().openapi()["paths"]

    assert {
        "/internal/v1/health",
        "/internal/v1/simulation/turn",
        "/internal/v1/simulation/assessment",
        "/internal/v1/brief",
    }.issubset(paths)


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
