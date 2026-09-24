from decimal import Decimal
import json
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.main import create_app
from services.ml.app.modules.brief import BriefGenerator, BriefService
from services.ml.app.schemas.contracts import BriefResult
from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.types import GatewayResult


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
TOKEN = {"X-Internal-Token": "test-internal-token"}


class FakeGateway:
    def __init__(self) -> None:
        self.requests = []
        self.output = BriefResult.model_validate(json.loads(
            (EXAMPLES / "brief.response.json").read_text(encoding="utf-8")
        ))

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.output.model_copy(deep=True), provider=Provider.OPENAI,
            model="synthetic-model", input_tokens=1, output_tokens=1,
            replayed=True, cached=False,
        )


def client(tmp_path: Path) -> tuple[TestClient, FakeGateway]:
    gateway = FakeGateway()
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    http = TestClient(create_app(
        settings, brief_service=BriefService(BriefGenerator(gateway)),
    ), raise_server_exceptions=False)
    return http, gateway


def payload() -> dict:
    return json.loads((EXAMPLES / "brief.request.json").read_text(encoding="utf-8"))


def test_http_brief_uses_real_service_and_frozen_result(tmp_path: Path) -> None:
    http, gateway = client(tmp_path)
    response = http.post("/internal/v1/brief", json=payload(), headers=TOKEN)
    assert response.status_code == 200
    result = BriefResult.model_validate(response.json())
    assert result.consistency[0].status == "discrepancy"
    assert result.consistency[0].observation.metric.value == "B2"
    assert result.summary != gateway.output.summary
    assert len(gateway.requests) == 1


def test_http_brief_without_simulation_english_is_honest(tmp_path: Path) -> None:
    http, _ = client(tmp_path)
    request = payload()
    request["simulationEnglish"] = None
    response = http.post("/internal/v1/brief", json=request, headers=TOKEN)
    assert response.status_code == 200
    assert response.json()["consistency"][0]["status"] == "unverified"
    assert response.json()["consistency"][0]["observation"]["metric"] is None


def test_http_brief_rejects_profile_and_missing_token(tmp_path: Path) -> None:
    http, gateway = client(tmp_path)
    assert http.post("/internal/v1/brief", json=payload()).status_code == 401
    request = payload()
    request["candidate"]["profile"] = {"fullName": "Synthetic Name"}
    response = http.post("/internal/v1/brief", json=request, headers=TOKEN)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert gateway.requests == []


def test_http_brief_rejects_ambiguous_source_ids(tmp_path: Path) -> None:
    http, gateway = client(tmp_path)
    request = payload()
    duplicate = request["candidate"]["application"]["answers"][0].copy()
    request["candidate"]["application"]["answers"].append(duplicate)
    response = http.post("/internal/v1/brief", json=request, headers=TOKEN)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert gateway.requests == []


def test_http_brief_returns_safe_error_for_fabricated_evidence(tmp_path: Path) -> None:
    http, gateway = client(tmp_path)
    for item in gateway.output.questions:
        for evidence in item.evidence:
            evidence.quote = "fabricated candidate claim"
    for item in gateway.output.consistency:
        for evidence in item.claim.evidence + item.observation.evidence:
            evidence.quote = "fabricated candidate claim"
    for item in gateway.output.clarify:
        for evidence in item.evidence:
            evidence.quote = "fabricated candidate claim"
    response = http.post("/internal/v1/brief", json=payload(), headers=TOKEN)
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "AI_INVALID_OUTPUT"
    assert "fabricated" not in str(response.json())
    assert len(gateway.requests) == 2


def test_missing_replay_cassette_never_calls_a_live_provider(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    http = TestClient(create_app(settings), raise_server_exceptions=False)
    request = payload()
    request["candidate"]["candidateId"] = "new-synthetic-id-without-a-cassette"
    response = http.post("/internal/v1/brief", json=request, headers=TOKEN)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_UNAVAILABLE"
