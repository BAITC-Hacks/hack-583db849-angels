"""Generate synthetic candidate WAV fixtures with the local eSpeak executable."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[3]


def generate() -> None:
    for candidate in ("a", "b", "c"):
        session_path = ROOT / "seed" / "candidates" / candidate / "m2a-session.json"
        session = json.loads(session_path.read_text(encoding="utf-8"))
        for turn in session["turns"]:
            output = ROOT / "fixtures" / "audio" / turn["audioRef"]
            output.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                [
                    "espeak",
                    "-v",
                    "en-us",
                    "-s",
                    "150",
                    "-w",
                    str(output),
                    turn["text"],
                ],
                check=True,
            )


if __name__ == "__main__":
    generate()
