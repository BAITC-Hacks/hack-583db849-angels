"""The prompts are frozen for the pitch (#25).

A prompt is part of the key of every answer recorded with it, so an edited
prompt silently stops the demo replaying: every request it builds misses its
recording. This test makes the edit loud. To change a prompt on purpose,
re-record its answers (GATEWAY_MODE=record) and update config/prompts.lock.json.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
PROMPTS = ROOT / "config" / "prompts"
PACKAGED = ROOT / "services" / "ml" / "stub_data" / "prompts"
LOCK = json.loads((ROOT / "config" / "prompts.lock.json").read_text(encoding="utf-8"))["prompts"]


def test_every_prompt_is_the_frozen_one() -> None:
    current = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(PROMPTS.glob("*.md"))}
    assert set(current) == set(LOCK), "a prompt was added or removed: record its answers and update config/prompts.lock.json"
    changed = [name for name, digest in current.items() if LOCK[name] != digest]
    assert not changed, f"{changed} changed after the freeze: re-record their answers, then update config/prompts.lock.json"


def test_every_packaged_prompt_matches_the_owned_one() -> None:
    for packaged in sorted(PACKAGED.glob("*.md")):
        assert packaged.read_bytes() == (PROMPTS / packaged.name).read_bytes(), packaged.name
