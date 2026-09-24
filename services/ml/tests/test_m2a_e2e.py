from decimal import Decimal
import json
import logging
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.gateway.cassettes import FileCassetteStore
from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.media import FileMediaCassetteStore, MediaGateway
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.main import create_app
from services.ml.app.modules.actor import ScenarioActor
from services.ml.app.modules.director import ScenarioDirector
from services.ml.app.modules.simulation import SimulationService
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.scripts.build_m2a_cassettes import SeedMatcher
from services.ml.scripts.smoke_m2a import run


ROOT = Path(__file__).resolve().parents[3]
AUDIO = ROOT / "fixtures" / "audio"
CASSETTES = ROOT / "fixtures" / "cassettes"


class TestClientTransport:
    __test__ = False

    def __init__(self, client: TestClient) -> None:
        self._client = client

    def request(self, method, path, *, payload=None, authenticated=True):
        headers = {"X-Internal-Token": "test-internal-token"} if authenticated else {}
        response = self._client.request(method, path, json=payload, headers=headers)
        media_type = response.headers.get("content-type", "").split(";", 1)[0]
        return response.status_code, media_type, response.content, 1.0


def application(tmp_path: Path):
    configuration = load_models_configuration()
    expected = {}
    for candidate in ("a", "b", "c"):
        session = json.loads(
            (
                ROOT / "seed" / "candidates" / candidate / "m2a-session.json"
            ).read_text(encoding="utf-8")
        )
        expected.update(
            {item["text"]: item["expectedAnswerType"] for item in session["turns"]}
        )
    model = ModelGateway(
        mode="replay",
        configuration=configuration,
        providers={},
        cassettes=FileCassetteStore(CASSETTES),
    )
    simulation = SimulationService(
        ScenarioRepository.load(ROOT_SCENARIOS),
        ScenarioDirector(SeedMatcher(expected)),
        ScenarioActor(model),
    )
    media = MediaGateway(
        mode="replay",
        configuration=configuration,
        providers={},
        cassettes=FileMediaCassetteStore(CASSETTES),
    )
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=AUDIO,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    return create_app(
        settings,
        media_gateway=media,
        model_gateway=model,
        simulation_service=simulation,
    )


def test_http_harness_completes_a_b_c_and_reports_only_safe_metrics(
    tmp_path: Path, caplog
) -> None:
    client = TestClient(application(tmp_path), raise_server_exceptions=False)

    with caplog.at_level(logging.INFO):
        report = run(TestClientTransport(client))

    assert report["mode"] == "replay"
    assert report["requests"] == 51
    assert report["sessions"] == [
        {"candidateId": "candidate-a", "candidateTurns": 5},
        {"candidateId": "candidate-b", "candidateTurns": 5},
        {"candidateId": "candidate-c", "candidateTurns": 4},
    ]
    assert report["latencyMs"] == {"median": 1.0, "p95": 1.0, "max": 1.0}
    serialized = json.dumps(report)
    assert "Timur" not in serialized
    assert "Dana" not in serialized
    assert "test-internal-token" not in serialized
    assert caplog.text.count("scenario_director_decision") == 17
    for marker in (
        "That sounds really unfair",
        "We'll figure it out",
        "Let's ask the mentor",
    ):
        assert marker not in caplog.text
