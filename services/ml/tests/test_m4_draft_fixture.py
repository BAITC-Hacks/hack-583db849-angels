import asyncio
from dataclasses import replace
from decimal import Decimal
import json
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from services.ml.app.config import Settings
from services.ml.app.evidence import interview_sources, verify_scores
from services.ml.app.gateway.cassettes import CassetteEnvelope, FileCassetteStore
from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.main import create_app
from services.ml.app.modules.interview_draft import InterviewDraftGenerator
from services.ml.app.providers.openai import OpenAIProvider
from services.ml.app.schemas.contracts import DraftRequest, DraftResult


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed/candidates/a"
CASSETTES = ROOT / "fixtures/cassettes"
TOKEN = {"X-Internal-Token": "test-internal-token"}


def draft_request() -> DraftRequest:
    return DraftRequest.model_validate({
        "candidateId": "00000000-0000-4000-8000-00000000000a",
        "transcript": json.loads((SEED / "interview-transcript.json").read_text(encoding="utf-8")),
        "notes": [],
    })


class CaptureGateway:
    def __init__(self, output: DraftResult) -> None:
        self.output = output
        self.request = None

    async def execute(self, request):
        self.request = request
        return GatewayResult(
            output=self.output, provider=Provider.OPENAI, model="synthetic",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


def test_authored_cassette_is_schema_valid_and_key_tracks_inputs() -> None:
    expected = DraftResult.model_validate_json(
        (SEED / "expected-interview-draft.json").read_text(encoding="utf-8")
    )
    capture = CaptureGateway(expected)
    asyncio.run(InterviewDraftGenerator(capture).generate(draft_request()))
    sent = capture.request
    assert sent.task == TaskName.INTERVIEW_DRAFT
    store = FileCassetteStore(CASSETTES)
    path = store.path_for(sent, Provider.OPENAI, "gpt-6-sol")
    assert path.is_file()
    envelope = CassetteEnvelope.model_validate_json(path.read_text(encoding="utf-8"))
    assert envelope.request_hash == path.stem
    assert envelope.request_id == "synthetic-m4-draft"
    authored = DraftResult.model_validate_json(envelope.response)
    assert [item.score for item in authored.scores] == [2, 3, None, 2, 4]
    assert "interviewerScores" not in path.read_text(encoding="utf-8")
    assert "interviewer-scores.json" not in path.read_text(encoding="utf-8")

    changed_prompt = replace(sent, prompt=sent.prompt + " revised")
    changed_transcript = replace(sent, payload={
        **sent.payload, "transcript": [{**sent.payload["transcript"][0], "text": "Changed"},
                                   *sent.payload["transcript"][1:]],
    })
    changed_rubric = replace(sent, payload={
        **sent.payload, "rubric": {**sent.payload["rubric"], "revision": "synthetic"},
    })
    assert len({store.path_for(item, Provider.OPENAI, "gpt-6-sol")
                for item in (sent, changed_prompt, changed_transcript, changed_rubric)}) == 4


def test_expected_a_quotes_are_candidate_turns_and_null_is_not_low_score() -> None:
    expected = DraftResult.model_validate_json(
        (SEED / "expected-interview-draft.json").read_text(encoding="utf-8")
    )
    request = draft_request()
    sources = interview_sources(request.transcript, request.notes)
    verification = verify_scores(expected.scores, sources)
    assert verification.dropped == 0
    assert [item.score for item in expected.scores] == [2, 3, None, 2, 4]
    assert expected.scores[2].evidence == []
    for item in expected.scores:
        if item.score is not None:
            assert any(piece.source == "interview_turn" for piece in item.evidence)
        for piece in item.evidence:
            assert piece.source == "interview_turn"
            assert piece.sourceId in {turn.turnId for turn in request.transcript
                                     if turn.speaker == "candidate"}


def test_a_draft_replays_over_http_without_model_network(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("provider forbidden")):
        response = TestClient(create_app(settings), raise_server_exceptions=False).post(
            "/internal/v1/interview/draft",
            json=draft_request().model_dump(mode="json"), headers=TOKEN,
        )

    assert response.status_code == 200
    result = DraftResult.model_validate(response.json())
    expected = DraftResult.model_validate_json(
        (SEED / "expected-interview-draft.json").read_text(encoding="utf-8")
    )
    assert result == expected
