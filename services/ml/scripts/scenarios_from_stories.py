"""Turn the scenario stories in docs/scenarios/ into config/scenarios/<id>.json.

The stories are the source people edit; the configs are what the simulator
reads. Every config is validated by ScenarioConfig. A scenario already marked
`ready` keeps that status: only the quality bench promotes a draft.

    python services/ml/scripts/scenarios_from_stories.py
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.schemas.contracts import ScenarioConfig


STORIES = ROOT / "docs" / "scenarios"
CONFIGS = ROOT / "config" / "scenarios"

# A distinct Deepgram Aura 2 voice per character, chosen by the story's description.
VOICES = {
    "female, energetic": ["aura-2-andromeda-en", "aura-2-aurora-en", "aura-2-phoebe-en"],
    "female, calm": ["aura-2-helena-en", "aura-2-selene-en"],
    "male, energetic": ["aura-2-apollo-en", "aura-2-hermes-en"],
    "male, calm": ["aura-2-orion-en", "aura-2-arcas-en"],
}
# The fallback of every beat, as in the first scenario: anything the matcher cannot place.
FALLBACK = {"answerTypeId": "other", "description": "Anything else", "examples": ["...", "ok", "hmm"]}
NUMBERS = {"five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}


class StoryError(ValueError):
    pass


def _field(text: str, label: str) -> str:
    match = re.search(rf"^- \*\*{re.escape(label)}:\*\* (.+)$", text, re.M)
    if not match:
        raise StoryError(f"missing '{label}'")
    return match.group(1).strip()


def _section(text: str, heading: str) -> str:
    match = re.search(rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    if not match:
        raise StoryError(f"missing section '{heading}'")
    return match.group(1)


def _beats(text: str) -> list[dict[str, object]]:
    beats = []
    for block in re.split(r"^### ", _section(text, "Beats"), flags=re.M)[1:]:
        heading = re.match(r"\d+ · `([a-z_]+)` — (.+)", block)
        shows = re.search(r"\*\*Shows:\*\* ([A-Z, ]+) · \*\*Moves on:\*\* after (\d+) turns?", block)
        if not heading or not shows:
            raise StoryError(f"a beat heading or its Shows line is malformed: {block[:60]!r}")
        answer_types, fallback = [], None
        for item in re.split(r"^- \*\*", block, flags=re.M)[1:]:
            intent = re.search(r"^\s+\*[^*]+:\* (.+)$", item, re.M)
            if item.startswith("Fallback"):
                target = re.match(r"Fallback\*\* → `([a-z_]+)`", item)
                if not target or not intent:
                    raise StoryError(f"a fallback in {heading.group(1)} is malformed")
                fallback = {**FALLBACK, "next": target.group(1), "characterIntent": intent.group(1).strip()}
                continue
            kind = re.match(r"`([a-z_]+)`\*\* → `([a-z_]+)` — (.+)$", item, re.M)
            examples = re.findall(r'^\s+- "(.+)"$', item, re.M)
            if not kind or not intent:
                raise StoryError(f"an answer type in {heading.group(1)} is malformed: {item[:60]!r}")
            answer_types.append({
                "answerTypeId": kind.group(1),
                "description": kind.group(3).strip().rstrip("."),
                "examples": examples,
                "next": kind.group(2),
                "characterIntent": intent.group(1).strip(),
            })
        if fallback is None:
            raise StoryError(f"beat {heading.group(1)} has no fallback")
        beats.append({
            "beatId": heading.group(1),
            "goal": heading.group(2).strip(),
            "competencies": [code.strip() for code in shows.group(1).split(",")],
            "maxTurns": int(shows.group(2)),
            "answerTypes": answer_types,
            "fallback": fallback,
        })
    return beats


def story_to_config(path: Path, voice_index: dict[str, int]) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    scenario_id = re.sub(r"^\d+-", "", path.stem)
    title = re.match(r"# \d+ · (.+)", text)
    setting = _section(text, "Setting").strip().split("\n\n")[0].strip()
    character = _section(text, "Character")
    length = re.search(r"about (\d+) minutes, (\w+)(?: or (\w+))? candidate turns", _field(text, "Length"))
    if not title or not length:
        raise StoryError("missing title or length")
    turns = max(NUMBERS[word] for word in length.groups()[1:] if word)
    voice_kind = _field(character, "Voice").rstrip(".").lower()
    voices = VOICES[voice_kind]
    voice = voices[voice_index.get(voice_kind, 0) % len(voices)]
    voice_index[voice_kind] = voice_index.get(voice_kind, 0) + 1

    existing = CONFIGS / f"{scenario_id}.json"
    status = json.loads(existing.read_text(encoding="utf-8"))["status"] if existing.is_file() else "draft"
    config = {
        "scenarioId": scenario_id,
        "status": status,
        "title": title.group(1).strip(),
        "situation": setting,
        "yourRole": _field(text, "Your role"),
        "goal": _field(text, "Goal"),
        "character": {
            "name": _field(character, "Name"),
            "role": _field(character, "Role"),
            "wants": _field(character, "Wants").rstrip("."),
        },
        "hiddenMotive": _field(character, "Hidden motive"),
        "voice": voice,
        "matchThreshold": 0.45,
        "expectedMinutes": int(length.group(1)),
        # One turn of slack over the longest path the story describes.
        "maxCandidateTurns": turns + 1,
        "beats": _beats(text),
    }
    ScenarioConfig.model_validate(config)
    return config


def main() -> None:
    voice_index: dict[str, int] = {}
    for path in sorted(STORIES.glob("[0-9][0-9]-*.md")):
        config = story_to_config(path, voice_index)
        target = CONFIGS / f"{config['scenarioId']}.json"
        target.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{target.relative_to(ROOT)}: {config['status']}, {len(config['beats'])} beats, voice {config['voice']}")


if __name__ == "__main__":
    main()
