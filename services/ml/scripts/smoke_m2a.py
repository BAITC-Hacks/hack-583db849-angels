"""Run the synthetic A/B/C M2a path through the internal HTTP API."""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
from statistics import median
from time import perf_counter
from typing import Any, Protocol
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[3]


class Transport(Protocol):
    def request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        authenticated: bool = True,
    ) -> tuple[int, str, bytes, float]: ...


class HttpTransport:
    def __init__(self, base_url: str, token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token

    def request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        authenticated: bool = True,
    ) -> tuple[int, str, bytes, float]:
        headers = {"Content-Type": "application/json"}
        if authenticated:
            headers["X-Internal-Token"] = self._token
        body = (
            json.dumps(payload, separators=(",", ":")).encode("utf-8")
            if payload is not None
            else None
        )
        request = Request(
            self._base_url + path,
            data=body,
            headers=headers,
            method=method,
        )
        started = perf_counter()
        try:
            with urlopen(request, timeout=15) as response:
                content = response.read()
                return (
                    response.status,
                    response.headers.get_content_type(),
                    content,
                    (perf_counter() - started) * 1000,
                )
        except HTTPError as error:
            return (
                error.code,
                error.headers.get_content_type(),
                error.read(),
                (perf_counter() - started) * 1000,
            )


def run(transport: Transport) -> dict[str, Any]:
    timings: list[float] = []
    status, _, content, elapsed = transport.request(
        "GET", "/internal/v1/health", authenticated=False
    )
    timings.append(elapsed)
    _expect_json(status, content, 200, expected_code=None)

    status, _, content, elapsed = transport.request(
        "GET", "/internal/v1/scenarios", authenticated=False
    )
    timings.append(elapsed)
    _expect_json(status, content, 401, expected_code="UNAUTHORIZED")

    status, _, content, elapsed = transport.request("GET", "/internal/v1/scenarios")
    timings.append(elapsed)
    scenarios = _expect_json(status, content, 200, expected_code=None)
    if not any(
        item.get("scenarioId") == "conflict-resolution"
        and item.get("status") == "ready"
        for item in scenarios
    ):
        raise RuntimeError("ready conflict-resolution scenario is unavailable")

    reports = []
    for candidate in ("a", "b", "c"):
        session = json.loads(
            (
                ROOT / "seed" / "candidates" / candidate / "m2a-session.json"
            ).read_text(encoding="utf-8")
        )
        transcript = []
        status, _, content, elapsed = transport.request(
            "POST",
            "/internal/v1/simulation/turn",
            payload={"scenarioId": session["scenarioId"], "turns": []},
        )
        timings.append(elapsed)
        result = _expect_json(status, content, 200, expected_code=None)
        _validate_turn_result(result, expected_stage="opening")
        transcript.append(_turn(1, "character", result["text"], 0))
        next_beat = result["director"]["nextBeat"]
        _speech(transport, session["scenarioId"], result["text"], timings)

        for index, expected in enumerate(session["turns"], start=1):
            status, _, content, elapsed = transport.request(
                "POST",
                "/internal/v1/transcribe",
                payload={
                    "purpose": "turn",
                    "audioRef": expected["audioRef"],
                    "language": "en",
                    "speakers": 1,
                },
            )
            timings.append(elapsed)
            recognised = _expect_json(status, content, 200, expected_code=None)
            if (
                len(recognised.get("turns", [])) != 1
                or recognised["turns"][0].get("text") != expected["text"]
                or recognised["turns"][0].get("confidence") is None
            ):
                raise RuntimeError("transcription did not match the synthetic session")
            transcript.append(_turn(index * 2, "candidate", expected["text"], index * 10))

            status, _, content, elapsed = transport.request(
                "POST",
                "/internal/v1/simulation/turn",
                payload={
                    "scenarioId": session["scenarioId"],
                    "turns": transcript,
                    "state": {"beat": next_beat, "candidateTurns": index},
                },
            )
            timings.append(elapsed)
            result = _expect_json(status, content, 200, expected_code=None)
            _validate_turn_result(result)
            if (
                result["director"]["matchedAnswerType"]
                != expected["expectedAnswerType"]
                or result["director"]["nextBeat"] != expected["expectedNextBeat"]
            ):
                raise RuntimeError("director branch did not match the synthetic session")
            _speech(transport, session["scenarioId"], result["text"], timings)
            transcript.append(
                _turn(index * 2 + 1, "character", result["text"], index * 10 + 5)
            )
            next_beat = result["director"]["nextBeat"]

        if not result["ended"] or result["stage"] != "finished":
            raise RuntimeError("synthetic session did not finish")
        reports.append({"candidateId": session["candidateId"], "candidateTurns": len(session["turns"])})

    ordered = sorted(timings)
    return {
        "mode": "replay",
        "sessions": reports,
        "requests": len(timings),
        "latencyMs": {
            "median": round(median(timings), 3),
            "p95": round(ordered[math.ceil(len(ordered) * 0.95) - 1], 3),
            "max": round(max(timings), 3),
        },
    }


def _speech(
    transport: Transport,
    scenario_id: str,
    text: str,
    timings: list[float],
) -> None:
    status, media_type, content, elapsed = transport.request(
        "POST",
        "/internal/v1/speech",
        payload={"scenarioId": scenario_id, "text": text},
    )
    timings.append(elapsed)
    if status != 200 or media_type != "audio/mpeg" or not content:
        raise RuntimeError("speech response is invalid")


def _expect_json(
    status: int,
    content: bytes,
    expected_status: int,
    *,
    expected_code: str | None,
) -> Any:
    if status != expected_status:
        raise RuntimeError(f"HTTP status {status}, expected {expected_status}")
    payload = json.loads(content)
    if expected_code is not None and payload.get("error", {}).get("code") != expected_code:
        raise RuntimeError("error response code is invalid")
    return payload


def _validate_turn_result(result: dict[str, Any], expected_stage: str | None = None) -> None:
    if expected_stage is not None and result.get("stage") != expected_stage:
        raise RuntimeError("turn stage is invalid")
    if len(result.get("text", "").split()) > 60:
        raise RuntimeError("character line exceeds 60 words")
    if set(result.get("director", {})) != {
        "beat",
        "matchedAnswerType",
        "similarity",
        "nextBeat",
        "reason",
    }:
        raise RuntimeError("director decision is invalid")


def _turn(number: int, speaker: str, text: str, second: int) -> dict[str, Any]:
    return {
        "turnId": f"turn_{number:02d}",
        "speaker": speaker,
        "text": text,
        "startedAt": f"2026-09-25T10:00:{second:02d}Z",
        "endedAt": f"2026-09-25T10:00:{second + 4:02d}Z",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    arguments = parser.parse_args()
    token = os.environ.get("ML_INTERNAL_TOKEN")
    if not token:
        raise SystemExit("ML_INTERNAL_TOKEN is required")
    print(json.dumps(run(HttpTransport(arguments.base_url, token)), sort_keys=True))
