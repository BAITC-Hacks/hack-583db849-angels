import json
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app


ROOT = Path(__file__).resolve().parents[3]
TURN_REQUEST = (
    ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml" / "simulation-turn.request.json"
)


def client() -> TestClient:
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=Path("/tmp/uploads"),
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def assert_error_shape(response: object, code: str) -> None:
    payload = response.json()
    assert set(payload) == {"error"}
    assert set(payload["error"]) == {"code", "message", "details", "traceId"}
    assert payload["error"]["code"] == code
    assert payload["error"]["details"] == {}
    assert payload["error"]["traceId"]


def test_health_is_public() -> None:
    response = client().get("/internal/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_route_rejects_a_missing_token() -> None:
    request = json.loads(TURN_REQUEST.read_text(encoding="utf-8"))

    response = client().post("/internal/v1/simulation/turn", json=request)

    assert response.status_code == 401
    assert_error_shape(response, "UNAUTHORIZED")


def test_protected_route_rejects_an_unknown_token() -> None:
    request = json.loads(TURN_REQUEST.read_text(encoding="utf-8"))

    response = client().post(
        "/internal/v1/simulation/turn",
        json=request,
        headers={"X-Internal-Token": "wrong-token"},
    )

    assert response.status_code == 401
    assert_error_shape(response, "UNAUTHORIZED")


def test_valid_token_reaches_the_current_contract_stub() -> None:
    request = json.loads(TURN_REQUEST.read_text(encoding="utf-8"))

    response = client().post(
        "/internal/v1/simulation/turn",
        json=request,
        headers={"X-Internal-Token": "test-internal-token"},
    )

    assert response.status_code == 501
    assert_error_shape(response, "NOT_IMPLEMENTED")


def test_validation_errors_do_not_echo_the_request() -> None:
    response = client().post(
        "/internal/v1/simulation/turn",
        json={"profile": {"fullName": "Do Not Echo"}},
        headers={"X-Internal-Token": "test-internal-token"},
    )

    assert response.status_code == 422
    assert_error_shape(response, "VALIDATION_ERROR")
    assert "Do Not Echo" not in response.text
