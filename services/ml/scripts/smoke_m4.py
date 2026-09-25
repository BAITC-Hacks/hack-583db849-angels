"""Prove the synthetic two-speaker recording yields an evidence-grounded draft."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from services.ml.app.evidence import interview_sources, verify_scores
from services.ml.app.schemas.contracts import DraftRequest, DraftResult, TranscribeResult
from services.ml.scripts.smoke_m2a import HttpTransport, Transport


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed/candidates/a"


def _call(
    transport: Transport, method: str, path: str, *, payload: dict | None = None,
    authenticated: bool = True, expected: int = 200, code: str | None = None,
) -> tuple[dict[str, Any], float]:
    status, _, content, elapsed = transport.request(
        method, path, payload=payload, authenticated=authenticated,
    )
    if status != expected:
        raise RuntimeError(f"M4 HTTP smoke expected {expected}, received {status}")
    parsed = json.loads(content)
    if code is not None and parsed.get("error", {}).get("code") != code:
        raise RuntimeError("M4 HTTP smoke received the wrong safe error code")
    return parsed, elapsed


def run(transport: Transport) -> dict[str, Any]:
    timings = []
    _, elapsed = _call(transport, "GET", "/internal/v1/health", authenticated=False)
    timings.append(elapsed)
    transcribe_payload = {
        "purpose": "interview", "audioRef": "interview/candidate-a.ogg",
        "language": "en", "speakers": 2,
    }
    parsed, elapsed = _call(
        transport, "POST", "/internal/v1/transcribe", payload=transcribe_payload,
    )
    timings.append(elapsed)
    transcription = TranscribeResult.model_validate(parsed)
    if len(transcription.turns) != 14 or {turn.speaker for turn in transcription.turns} != {
        "interviewer", "candidate",
    }:
        raise RuntimeError("M4 recording did not produce both expected speaker roles")
    transcript = [
        {"turnId": f"iturn_{index:02d}", "speaker": turn.speaker,
         "text": turn.text, "startSec": turn.startSec, "endSec": turn.endSec}
        for index, turn in enumerate(transcription.turns, start=1)
    ]
    expected_transcript = json.loads(
        (SEED / "interview-transcript.json").read_text(encoding="utf-8")
    )
    if transcript != expected_transcript:
        raise RuntimeError("M4 spoken transcript differs from the reference story")
    payload = DraftRequest.model_validate({
        "candidateId": "00000000-0000-4000-8000-00000000000a",
        "transcript": transcript, "notes": [],
    }).model_dump(mode="json")
    parsed, elapsed = _call(
        transport, "POST", "/internal/v1/interview/draft", payload=payload,
    )
    timings.append(elapsed)
    result = DraftResult.model_validate(parsed)
    expected = DraftResult.model_validate_json(
        (SEED / "expected-interview-draft.json").read_text(encoding="utf-8")
    )
    if result != expected:
        raise RuntimeError("M4 draft differs from the independently fixed reference")
    sources = interview_sources(DraftRequest.model_validate(payload).transcript, [])
    verification = verify_scores(result.scores, sources)
    if verification.dropped or verification.submitted != 4:
        raise RuntimeError("M4 draft evidence did not resolve to the played transcript")
    for item in result.scores:
        if item.score is not None and not any(
            piece.source == "interview_turn" for piece in item.evidence
        ):
            raise RuntimeError("M4 score has no candidate-turn evidence")

    negatives = [
        (payload, False, 401, "UNAUTHORIZED"),
        ({**payload, "scores": {}}, True, 422, "VALIDATION_ERROR"),
        ({**payload, "interviewerScores": {}}, True, 422, "VALIDATION_ERROR"),
        ({**payload, "profile": {"fullName": "Synthetic Person"}}, True, 422, "VALIDATION_ERROR"),
        ({**payload, "notes": [{"id": "iturn_01", "text": "Ambiguous"}]},
         True, 422, "VALIDATION_ERROR"),
    ]
    for rejected, authenticated, status, code in negatives:
        response, elapsed = _call(
            transport, "POST", "/internal/v1/interview/draft",
            payload=rejected, authenticated=authenticated, expected=status, code=code,
        )
        timings.append(elapsed)
        if "Synthetic Person" in str(response):
            raise RuntimeError("M4 error leaked a profile value")

    changed = json.loads(json.dumps(payload))
    changed["transcript"][1]["text"] = "I changed the plan after hearing both sides."
    _, elapsed = _call(
        transport, "POST", "/internal/v1/interview/draft", payload=changed,
        expected=503, code="AI_UNAVAILABLE",
    )
    timings.append(elapsed)
    return {
        "mode": "replay",
        "requests": len(timings),
        "turnsChecked": len(transcript),
        "scoresChecked": len(result.scores),
        "quotesChecked": verification.submitted,
        "negativeCases": len(negatives) + 1,
        "maxLatencyMs": round(max(timings), 2),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    options = parser.parse_args()
    token = os.environ.get("ML_INTERNAL_TOKEN")
    if not token:
        raise SystemExit("ML_INTERNAL_TOKEN is required")
    print(json.dumps(run(HttpTransport(options.base_url, token)), sort_keys=True))
