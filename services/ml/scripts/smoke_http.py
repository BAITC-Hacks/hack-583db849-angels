"""Smoke-test every F0 ML operation through real HTTP."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
SILENT_MP3 = ROOT / "fixtures" / "audio" / "silence.mp3"


def load_json(filename: str) -> Any:
    return json.loads((EXAMPLES / filename).read_text(encoding="utf-8"))


def request(
    base_url: str,
    method: str,
    path: str,
    token: str | None = None,
    body: Any | None = None,
) -> tuple[int, str | None, bytes]:
    headers: dict[str, str] = {}
    if token is not None:
        headers["X-Internal-Token"] = token
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    operation = Request(
        f"{base_url.rstrip('/')}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(operation, timeout=5) as response:
            return response.status, response.headers.get_content_type(), response.read()
    except HTTPError as error:
        return error.code, error.headers.get_content_type(), error.read()


def json_body(raw: bytes) -> Any:
    return json.loads(raw.decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--token", required=True)
    parser.add_argument(
        "--audio-ref",
        default="tmp/recordings/6f1c2a0e-a004.webm",
        help="Relative audioRef that exists below the service UPLOADS_DIR",
    )
    arguments = parser.parse_args()

    operations: list[tuple[str, str, Any | None, Any]] = [
        ("GET", "/internal/v1/scenarios", None, load_json("scenarios.response.json")),
        (
            "GET",
            "/internal/v1/scenarios/conflict-resolution",
            None,
            load_json("scenarios.response.json")[0],
        ),
        (
            "POST",
            "/internal/v1/simulation/turn",
            load_json("simulation-turn.request.json"),
            load_json("simulation-turn.response.json"),
        ),
        (
            "POST",
            "/internal/v1/simulation/assessment",
            load_json("simulation-assessment.request.json"),
            load_json("simulation-assessment.response.json"),
        ),
        (
            "POST",
            "/internal/v1/brief",
            load_json("brief.request.json"),
            load_json("brief.response.json"),
        ),
        (
            "POST",
            "/internal/v1/consistency",
            load_json("consistency-before.request.json"),
            load_json("consistency-before.response.json"),
        ),
        (
            "POST",
            "/internal/v1/consistency",
            load_json("consistency-after.request.json"),
            load_json("consistency-after.response.json"),
        ),
        (
            "POST",
            "/internal/v1/surprise-question",
            load_json("surprise-question.request.json"),
            load_json("surprise-question.response.json"),
        ),
        (
            "GET",
            "/internal/v1/usage",
            None,
            load_json("usage.response.json"),
        ),
        (
            "POST",
            "/internal/v1/interview/draft",
            load_json("interview-draft.request.json"),
            load_json("interview-draft.response.json"),
        ),
        (
            "POST",
            "/internal/v1/quality-check",
            load_json("quality-check-interview.request.json"),
            load_json("quality-check-interview.response.json"),
        ),
        (
            "POST",
            "/internal/v1/quality-check",
            load_json("quality-check-calibration.request.json"),
            load_json("quality-check-calibration.response.json"),
        ),
    ]

    transcribe_request = load_json("transcribe.request.json")
    transcribe_request["audioRef"] = arguments.audio_ref
    operations.append(
        (
            "POST",
            "/internal/v1/transcribe",
            transcribe_request,
            load_json("transcribe.response.json"),
        )
    )

    status, _, raw = request(arguments.base_url, "GET", "/internal/v1/health")
    assert status == 200 and json_body(raw) == {"status": "ok"}

    for method, path, body, expected in operations:
        status, _, raw = request(arguments.base_url, method, path, body=body)
        assert status == 401, f"{method} {path} without token returned {status}"
        assert json_body(raw)["error"]["code"] == "UNAUTHORIZED"

        status, media_type, raw = request(
            arguments.base_url,
            method,
            path,
            token=arguments.token,
            body=body,
        )
        assert status == 200, f"{method} {path} returned {status}"
        assert media_type == "application/json"
        assert json_body(raw) == expected

    speech_request = {"text": "Synthetic speech fixture.", "voice": "demo"}
    status, _, _ = request(
        arguments.base_url,
        "POST",
        "/internal/v1/speech",
        body=speech_request,
    )
    assert status == 401
    status, media_type, raw = request(
        arguments.base_url,
        "POST",
        "/internal/v1/speech",
        token=arguments.token,
        body=speech_request,
    )
    assert status == 200 and media_type == "audio/mpeg"
    assert raw == SILENT_MP3.read_bytes()

    print(f"ML HTTP smoke passed: health plus {len(operations) + 1} protected calls")


if __name__ == "__main__":
    main()
