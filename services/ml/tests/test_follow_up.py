"""Offline follow-up grounding, safety, and replay contract tests."""

import asyncio
from decimal import Decimal
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from services.ml.app.config import Settings
from services.ml.app.gateway.cassettes import CassetteEnvelope
from services.ml.app.gateway.config import TaskName
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.main import create_app
from services.ml.app.modules.follow_up import (
    FollowUpProposal, FollowUpWriter, checked_suggestions, load_follow_up_policy,
)
from services.ml.app.modules.surprise import load_surprise_policy
from services.ml.app.schemas.contracts import EarlierSuggestion, FollowUpRequest, FollowUpResult, FollowUpSuggestion, PlannedQuestion


ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "docs/contracts/examples/candidate-a/ml"
CASSETTES = ROOT / "fixtures/cassettes/interview_follow_up"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def contract() -> FollowUpRequest:
    return FollowUpRequest.model_validate(load(CONTRACT / "interview-follow-up.request.json"))


def suggestion() -> FollowUpSuggestion:
    return FollowUpSuggestion.model_validate(load(CONTRACT / "interview-follow-up.response.json")["suggestions"][0])


class FakeGateway:
    def __init__(self, *outputs: dict):
        self.outputs = list(outputs)
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=FollowUpProposal.model_validate(self.outputs.pop(0)),
            provider="openai", model="synthetic", input_tokens=0, output_tokens=0,
            replayed=True, cached=False,
        )


def accepted(items: list[FollowUpSuggestion], request: FollowUpRequest | None = None):
    return checked_suggestions(items, request or contract(), load_follow_up_policy(), load_surprise_policy())


def mutate(**changes) -> FollowUpSuggestion:
    return suggestion().model_copy(update=changes)


def test_contract_grounding_and_privacy() -> None:
    gateway = FakeGateway({"suggestions": [suggestion().model_dump()]})
    result = asyncio.run(FollowUpWriter(gateway).write(contract()))
    assert result.suggestions == [suggestion()]
    sent = gateway.requests[0]
    assert sent.task == TaskName.INTERVIEW_FOLLOW_UP
    assert sent.output_schema is FollowUpProposal
    assert "candidateId" not in json.dumps(sent.payload)
    assert "fullName" not in json.dumps(sent.payload)
    assert sent.payload["answer"][1]["segmentId"] == "fseg_02"


@pytest.mark.parametrize("changes", [
    {"question": "What happened? Why did it happen?"},
    {"question": "What happened"},
    {"question": " ".join(["What"] * 31) + "?"},
    {"question": "Don't you think you should have asked the team?"},
    {"question": "The others agreed with you, right?"},
    {"question": "Surely everyone supported it?"},
    {"question": "What did your parents think?"},
    {"why": "The candidate is evasive."},
    {"question": "Why are you dishonest?"},
    {"why": "The answer was a fail."},
    {"why": "The answer mentions a failure."},
    {"why": "Their English grammar was poor."},
    {"question": "Was your accent the problem?"},
], ids=["two questions", "missing mark", "long", "leading", "trailing leading", "surely", "off limits", "person", "judgment", "fail", "failure", "english", "accent"])
def test_unsafe_suggestions_are_dropped(changes) -> None:
    assert accepted([mutate(**changes)]) == []


def test_unsupported_quote_or_source_drops_the_whole_suggestion() -> None:
    base = suggestion()
    for item in (
        base.evidence[0].model_copy(update={"quote": "Invented quote"}),
        base.evidence[0].model_copy(update={"sourceId": "fseg_99"}),
        base.evidence[0].model_copy(update={"source": "interview_turn"}),
    ):
        assert accepted([base.model_copy(update={"evidence": [item]})]) == []
    assert accepted([base.model_copy(update={"evidence": []})]) == []


def test_reasons_require_their_specific_sources() -> None:
    base = suggestion()
    assert accepted([mutate(reason="mismatch")]) == []
    application = {"source": "application_field", "sourceId": "setback", "quote": "Our robot broke two days before the final."}
    valid = mutate(reason="mismatch", evidence=[base.evidence[0], base.evidence[0].__class__(**application)])
    assert accepted([valid]) == [valid]
    assert accepted([valid.model_copy(update={"reason": "vague"})]) == []
    invented = valid.model_copy(update={"evidence": [base.evidence[0], valid.evidence[1].model_copy(update={"quote": "invented"})]})
    assert accepted([invented]) == []


def test_no_repeats_including_dismissed_and_same_output() -> None:
    item = suggestion()
    request = contract()
    request.plannedQuestions.append(PlannedQuestion(focus="V", question=item.question.upper()))
    assert accepted([item], request) == []
    request = contract()
    request.earlier.append(EarlierSuggestion(question=item.question, competency="V", status="dismissed"))
    assert accepted([item], request) == []
    assert accepted([item, item]) == [item]
    assert len(accepted([item, item.model_copy(update={"question": "Which step came next?"}), item.model_copy(update={"question": "What happened next?"})])) == 2


def test_invalid_semantics_retry_once_then_empty_but_empty_is_not_padded() -> None:
    bad = {"suggestions": [mutate(question="Surely everyone agreed?").model_dump()]}
    good = {"suggestions": [suggestion().model_dump()]}
    gateway = FakeGateway(bad, good)
    assert asyncio.run(FollowUpWriter(gateway).write(contract())).suggestions == [suggestion()]
    assert [entry.payload["attempt"] for entry in gateway.requests] == [1, 2]
    assert asyncio.run(FollowUpWriter(FakeGateway(bad, bad)).write(contract())).suggestions == []
    gateway = FakeGateway({"suggestions": []})
    assert asyncio.run(FollowUpWriter(gateway).write(contract())).suggestions == []
    assert len(gateway.requests) == 1


def test_invalid_json_schema_returns_ai_invalid_output_after_gateway_retry(tmp_path: Path) -> None:
    from services.ml.app.gateway.config import load_models_configuration, Provider
    from services.ml.app.gateway.service import ModelGateway
    from services.ml.app.gateway.cassettes import FileCassetteStore
    from services.ml.app.gateway.types import ProviderResponse

    class BadProvider:
        def __init__(self):
            self.calls = 0

        async def generate(self, request):
            self.calls += 1
            return ProviderResponse(content='{"suggestions":"invalid"}', input_tokens=1, output_tokens=1)

    provider = BadProvider()
    gateway = ModelGateway(
        mode="live", configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider}, cassettes=FileCassetteStore(tmp_path),
    )
    with pytest.raises(Exception, match="model output failed schema validation"):
        asyncio.run(FollowUpWriter(gateway).write(contract()))
    assert provider.calls == 2


def test_strict_schema_and_privacy_boundary() -> None:
    schema = FollowUpProposal.model_json_schema()
    assert set(schema["required"]) == set(schema["properties"])
    assert schema["additionalProperties"] is False
    with pytest.raises(ValidationError):
        FollowUpRequest.model_validate({**contract().model_dump(), "fullName": "Synthetic Person"})
    with pytest.raises(ValidationError):
        FollowUpRequest.model_validate({**contract().model_dump(), "answer": []})


def test_seed_and_contract_replay_offline(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="t", uploads_dir=tmp_path, gateway_mode="replay",
        budget_usd_cap=Decimal("1"), demo_mode=False, usage_log_path=tmp_path / "usage.jsonl",
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    cases = [(load(CONTRACT / "interview-follow-up.request.json"),
              load(CONTRACT / "interview-follow-up.response.json"))]
    for letter in "abc":
        seed = ROOT / "seed/candidates" / letter
        snapshot = load(seed / "snapshot.json")
        answer = load(seed / "follow-up-answer.json")
        brief = load(seed / "expected-brief.json")
        assert answer["question"] in [item["question"] for item in brief["questions"]]
        cases.append(({
            "candidate": {"candidateId": f"00000000-0000-4000-8000-00000000000{letter}",
                          "application": snapshot["application"], "test": snapshot["test"],
                          "englishCertificate": snapshot["englishCertificate"]},
            "plannedQuestions": [{"focus": item["focus"], "question": item["question"]} for item in brief["questions"]],
            "question": answer["question"],
            "answer": answer["segments"], "earlier": [],
        }, load(seed / "expected-follow-up.json")))
    for raw_request, expected in cases:
        response = client.post("/internal/v1/interview/follow-up", json=raw_request,
                               headers={"X-Internal-Token": "t"})
        assert response.status_code == 200, response.text
        assert response.json() == expected
        result = FollowUpResult.model_validate(response.json())
        for item in result.suggestions:
            assert accepted([item], FollowUpRequest.model_validate(raw_request)) == [item]
    assert [(result["suggestions"][0]["reason"], result["suggestions"][0]["competency"])
            for _, result in cases[1:]] == [("no_evidence", "V"), ("vague", "D"), ("mismatch", "D")]
    assert len(list(CASSETTES.glob("*.json"))) == 4
    for path in CASSETTES.glob("*.json"):
        cassette = CassetteEnvelope.model_validate_json(path.read_text())
        assert path.stem == cassette.request_hash
        assert cassette.task is TaskName.INTERVIEW_FOLLOW_UP
        assert cassette.request_id.startswith("synthetic-")
        assert "candidateId" not in path.read_text()


def test_grammar_changes_never_influence_rules_or_reason() -> None:
    original = contract()
    modified = original.model_copy(deep=True)
    modified.answer[1].text = "It work, but I did not ask the others how the change affected them."
    item = suggestion()
    assert accepted([item], modified) == [item]
    assert item.reason == "no_evidence"


def test_packaged_prompt_and_policy_are_identical() -> None:
    assert (ROOT / "config/prompts/interview-follow-up.md").read_bytes() == (ROOT / "services/ml/stub_data/prompts/interview-follow-up.md").read_bytes()
    assert load(ROOT / "config/follow-up.json") == load(ROOT / "services/ml/stub_data/follow-up.json")
