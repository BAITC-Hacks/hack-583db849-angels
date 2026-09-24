"""Derive seed voice sessions from transcripts and synthesize Ogg Opus audio."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed" / "candidates"
AUDIO = ROOT / "fixtures" / "audio"
ROUTES = {
    "a": (
        ("rush_to_fix", "trust"),
        ("process_rule", "fairness"),
        ("handle_alone", "decision"),
        ("plan_with_owners", "setback"),
        ("recover_with_team", "end"),
    ),
    "b": (
        ("rush_to_fix", "trust"),
        ("process_rule", "fairness"),
        ("handle_alone", "decision"),
        ("plan_with_owners", "setback"),
        ("push_harder", "end"),
    ),
    "c": (
        ("acknowledge", "trust"),
        ("promise", "decision"),
        ("delegate_up", "setback"),
        ("push_harder", "end"),
    ),
}


def export_sessions() -> list[dict]:
    sessions = []
    for candidate, route in ROUTES.items():
        directory = SEED / candidate
        transcript = json.loads(
            (directory / "transcript.json").read_text(encoding="utf-8")
        )
        if len(transcript) != len(route) * 2 + 1:
            raise ValueError(f"candidate {candidate} transcript has an invalid turn count")
        if transcript[0]["speaker"] != "character":
            raise ValueError(f"candidate {candidate} transcript lacks an opening")

        turns = []
        for index, (answer_type, next_beat) in enumerate(route, start=1):
            answer = transcript[index * 2 - 1]
            character = transcript[index * 2]
            if answer["speaker"] != "candidate" or character["speaker"] != "character":
                raise ValueError(f"candidate {candidate} transcript is not alternating")
            turns.append(
                {
                    "audioRef": f"m2a/candidate-{candidate}/turn-{index:02d}.ogg",
                    "text": answer["text"],
                    "expectedAnswerType": answer_type,
                    "expectedNextBeat": next_beat,
                    "characterLine": character["text"],
                }
            )

        session = {
            "version": 1,
            "candidateId": f"candidate-{candidate}",
            "scenarioId": "conflict-resolution",
            "openingLine": transcript[0]["text"],
            "turns": turns,
        }
        (directory / "m2a-session.json").write_text(
            json.dumps(session, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        sessions.append(session)
    return sessions


def generate_audio(sessions: list[dict]) -> None:
    with TemporaryDirectory() as temporary:
        wave_path = Path(temporary) / "synthetic.wav"
        for session in sessions:
            for turn in session["turns"]:
                output = AUDIO / turn["audioRef"]
                output.parent.mkdir(parents=True, exist_ok=True)
                subprocess.run(
                    ["espeak-ng", "-v", "en-us", "-s", "150", "-w", str(wave_path), turn["text"]],
                    check=True,
                )
                subprocess.run(
                    [
                        "ffmpeg", "-nostdin", "-loglevel", "error", "-y",
                        "-i", str(wave_path), "-c:a", "libopus", "-b:a", "24k", str(output),
                    ],
                    check=True,
                )
                if not output.read_bytes().startswith(b"OggS"):
                    raise RuntimeError(f"generated audio is not Ogg: {turn['audioRef']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sessions-only", action="store_true")
    arguments = parser.parse_args()
    generated_sessions = export_sessions()
    if not arguments.sessions_only:
        generate_audio(generated_sessions)
