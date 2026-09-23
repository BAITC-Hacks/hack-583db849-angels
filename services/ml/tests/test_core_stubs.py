import json
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
TOKEN = {"X-Internal-Token": "test-internal-token"}


@pytest.fixture
def client() -> TestClient:
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=Path("/tmp/uploads"),
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def example(filename: str) -> object:
    return json.loads((EXAMPLES / filename).read_text(encoding="utf-8"))


def test_scenario_list_is_projected_from_the_validated_config(client: TestClient) -> None:
    response = client.get("/internal/v1/scenarios", headers=TOKEN)
    expected = [
        item.model_dump(mode="json")
        for item in ScenarioRepository.load(ROOT_SCENARIOS).briefs()
    ]

    assert response.status_code == 200
    assert response.json() == expected


def test_scenario_detail_returns_only_the_public_scenario(client: TestClient) -> None:
    response = client.get(
        "/internal/v1/scenarios/conflict-resolution",
        headers=TOKEN,
    )

    assert response.status_code == 200
    expected = ScenarioRepository.load(ROOT_SCENARIOS).brief("conflict-resolution")
    assert expected is not None
    assert response.json() == expected.model_dump(mode="json")
    assert "hiddenMotive" not in response.json()
    assert "beats" not in response.json()
    assert "voice" not in response.json()


def test_unknown_scenario_returns_a_safe_error(client: TestClient) -> None:
    response = client.get("/internal/v1/scenarios/unknown", headers=TOKEN)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SCENARIO_NOT_FOUND"


@pytest.mark.parametrize(
    ("path", "request_name", "response_name"),
    [
        (
            "/internal/v1/simulation/assessment",
            "simulation-assessment.request.json",
            "simulation-assessment.response.json",
        ),
        ("/internal/v1/brief", "brief.request.json", "brief.response.json"),
    ],
)
def test_core_post_stubs_return_the_frozen_examples(
    client: TestClient,
    path: str,
    request_name: str,
    response_name: str,
) -> None:
    response = client.post(path, json=example(request_name), headers=TOKEN)

    assert response.status_code == 200
    assert response.json() == example(response_name)
