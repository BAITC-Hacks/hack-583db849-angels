"""The C endpoint uses the real grounded service, not the F0 example stub."""

import json
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.errors import GatewayProviderError
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.main import create_app
from services.ml.app.modules.consistency import ConsistencyGenerator, ConsistencyService
from services.ml.app.schemas.contracts import BriefResult, ConsistencyResult


EXAMPLES = Path(__file__).resolve().parents[3] / "docs/contracts/examples/candidate-a/ml"
TOKEN = {"X-Internal-Token": "test-internal-token"}


def example(name: str) -> dict:
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


class FakeGateway:
    def __init__(self, output: ConsistencyResult) -> None:
        self.output = output
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.output, provider=Provider.OPENAI, model="synthetic-model",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


class FakeBrief:
    def __init__(self) -> None:
        self.output = BriefResult.model_validate(example("brief.response.json"))
        self.calls = 0

    async def prepare(self, request):
        self.calls += 1
        return self.output


def client(tmp_path: Path) -> tuple[TestClient, FakeGateway, FakeBrief]:
    gateway = FakeGateway(ConsistencyResult.model_validate(example(
        "consistency-after.response.json"
    )))
    brief = FakeBrief()
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
    )
    app = create_app(
        settings,
        consistency_service=ConsistencyService(ConsistencyGenerator(gateway), brief),
    )
    return TestClient(app, raise_server_exceptions=False), gateway, brief


def test_before_http_uses_m1_shared_brief(tmp_path: Path) -> None:
    http, gateway, brief = client(tmp_path)

    response = http.post(
        "/internal/v1/consistency",
        json=example("consistency-before.request.json"), headers=TOKEN,
    )

    assert response.status_code == 200
    assert response.json()["items"] == [
        item.model_dump(mode="json") for item in brief.output.consistency
    ]
    assert brief.calls == 1
    assert gateway.requests == []


def test_after_http_revisits_actual_request_items(tmp_path: Path) -> None:
    http, gateway, brief = client(tmp_path)
    request = example("consistency-after.request.json")

    response = http.post("/internal/v1/consistency", json=request, headers=TOKEN)

    assert response.status_code == 200
    result = ConsistencyResult.model_validate(response.json())
    assert [item.status for item in result.items] == ["confirmed", "confirmed", "unverified"]
    assert [item.itemId for item in result.items] == ["c_01", "c_02", "c_03"]
    assert result.items[0].observation.metric.source == "simulation"
    assert result.items[1].observation.evidence[0].sourceId == "iturn_02"
    assert all(item.askInInterview is None for item in result.items)
    assert brief.calls == 0
    assert "candidateId" not in gateway.requests[0].payload["candidate"]


def test_consistency_http_rejects_profile_and_scores(tmp_path: Path) -> None:
    http, _, _ = client(tmp_path)
    request = example("consistency-after.request.json")
    request["candidate"]["profile"] = {"fullName": "Synthetic Person"}
    response = http.post("/internal/v1/consistency", json=request, headers=TOKEN)
    assert response.status_code == 422
    assert "Synthetic Person" not in response.text

    request = example("consistency-after.request.json")
    request["interviewerScores"] = [{"competency": "D", "score": 4}]
    response = http.post("/internal/v1/consistency", json=request, headers=TOKEN)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_consistency_http_rejects_before_items_on_before_stage(tmp_path: Path) -> None:
    http, _, _ = client(tmp_path)
    request = example("consistency-after.request.json")
    request["stage"] = "before"

    response = http.post("/internal/v1/consistency", json=request, headers=TOKEN)

    assert response.status_code == 422


def test_after_http_depends_on_supplied_candidate_speech(tmp_path: Path) -> None:
    http, _, _ = client(tmp_path)
    request = example("consistency-after.request.json")
    cited_id = request["beforeItems"][1]["itemId"]
    assert cited_id == "c_02"
    request["interviewTranscript"] = []

    response = http.post("/internal/v1/consistency", json=request, headers=TOKEN)

    assert response.status_code == 200
    assert response.json()["items"][1]["status"] == request["beforeItems"][1]["status"]


def test_consistency_http_requires_token_and_hides_provider_failure(tmp_path: Path) -> None:
    http, gateway, _ = client(tmp_path)
    request = example("consistency-after.request.json")

    unauthorized = http.post("/internal/v1/consistency", json=request)
    assert unauthorized.status_code == 401

    async def unavailable(_request):
        raise GatewayProviderError("synthetic provider detail must be hidden")

    gateway.execute = unavailable
    response = http.post("/internal/v1/consistency", json=request, headers=TOKEN)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_UNAVAILABLE"
    assert "synthetic provider detail" not in response.text


def test_after_http_repairs_reordered_model_claims(tmp_path: Path) -> None:
    http, gateway, _ = client(tmp_path)
    request = example("consistency-after.request.json")
    gateway.output.items.reverse()
    gateway.output.items[0].claim.text = "A model-invented replacement"
    gateway.output.items[0].topic = "other"

    response = http.post("/internal/v1/consistency", json=request, headers=TOKEN)

    assert response.status_code == 200
    assert [item["itemId"] for item in response.json()["items"]] == [
        "c_01", "c_02", "c_03",
    ]
    for saved, returned in zip(request["beforeItems"], response.json()["items"], strict=True):
        assert returned["claim"] == saved["claim"]
        assert returned["topic"] == saved["topic"]


def test_after_http_rejects_duplicate_source_ids_before_gateway(tmp_path: Path) -> None:
    http, gateway, _ = client(tmp_path)
    request = example("consistency-after.request.json")
    request["interviewTranscript"][1]["turnId"] = request["interviewTranscript"][0]["turnId"]

    response = http.post("/internal/v1/consistency", json=request, headers=TOKEN)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert gateway.requests == []
