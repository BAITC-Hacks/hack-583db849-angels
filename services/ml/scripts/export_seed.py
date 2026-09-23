"""Build the deterministic synthetic F0 seed files from frozen examples."""

from __future__ import annotations

import json
from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed" / "candidates"
EXAMPLES = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
CANDIDATE_IDS = {
    "a": "00000000-0000-4000-8000-00000000000a",
    "b": "00000000-0000-4000-8000-00000000000b",
    "c": "00000000-0000-4000-8000-00000000000c",
}
FOCUSES = ["D", "R", "I", "V", "E", "invision_knowledge", "english", "motivation"]


def write(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def turn(turn_id: str, speaker: str, text: str, minute: int) -> dict:
    return {
        "turnId": turn_id,
        "speaker": speaker,
        "text": text,
        "startedAt": f"2026-09-25T10:{minute:02d}:00Z",
        "endedAt": f"2026-09-25T10:{minute:02d}:30Z",
    }


def brief(candidate: str, snapshot: dict) -> dict:
    answers = {item["fieldId"]: item for item in snapshot["application"]["answers"]}
    focus_fields = {
        "D": "setback",
        "R": "leadership_example",
        "I": "community",
        "V": "leadership_example",
        "E": "leadership_example",
        "invision_knowledge": "motivation",
        "english": "english_self",
        "motivation": "motivation",
    }
    questions = []
    for focus in FOCUSES:
        answer = answers[focus_fields[focus]]
        questions.append(
            {
                "focus": focus,
                "question": f"Candidate {candidate.upper()}: give a specific recent example for {focus}.",
                "why": "The written answer needs a concrete, verifiable example.",
                "evidence": [
                    {
                        "source": "application_field",
                        "sourceId": answer["fieldId"],
                        "quote": answer["answer"],
                    }
                ],
            }
        )
    return {
        "summary": f"Synthetic preparation brief for candidate {candidate.upper()}.",
        "questions": questions,
        "consistency": [],
        "clarify": [],
        "english": {
            "certificate": None,
            "writtenCefr": "B2" if candidate == "b" else "B1",
            "basis": "Estimated from synthetic written answers only; leadership scoring is separate.",
        },
    }


def score(code: str, value: int | None, turn_id: str, quote: str) -> dict:
    if value is None:
        return {
            "competency": code,
            "score": None,
            "confidence": None,
            "rationale": None,
            "evidence": [],
        }
    return {
        "competency": code,
        "score": value,
        "confidence": "medium",
        "rationale": "The synthetic transcript contains a concrete behavior matching the rubric.",
        "evidence": [
            {"source": "simulation_turn", "sourceId": turn_id, "quote": quote}
        ],
    }


def assessment(candidate: str, turns: list[dict]) -> dict:
    candidate_turns = [item for item in turns if item["speaker"] == "candidate"]
    if candidate == "b":
        values = [1, 3, 4, 3, 2]
        scores = [
            score(code, value, item["turnId"], item["text"])
            for code, value, item in zip("DRIVE", values, candidate_turns, strict=True)
        ]
        questions = [
            {
                "competency": "D",
                "question": "What helped you restart after the pause?",
                "reason": "The recovery depended on another person restarting the discussion.",
            }
        ]
        feedback = {
            "strengths": ["You connected the immediate problem to a longer-term goal."],
            "growth": ["When momentum drops, name the first action you will take yourself."],
            "nextTime": ["Set a restart checkpoint before ending the conversation."],
        }
    else:
        scores = [score(code, None, "", "") for code in "DRIVE"]
        questions = [
            {
                "competency": code,
                "question": f"Tell me about a specific situation where you demonstrated {code}.",
                "reason": "There is not enough verified behavioral evidence yet.",
            }
            for code in "DRIVE"
        ]
        feedback = {
            "strengths": ["You stayed engaged with the conversation."],
            "growth": ["Use a real example and explain your own action and its effect."],
            "nextTime": ["Prepare one recent situation with a challenge, action, and outcome."],
        }
    return {
        "scores": scores,
        "english": {
            "wordsPerMinute": 104.0 if candidate == "b" else None,
            "fillerRate": 0.04 if candidate == "b" else None,
            "meanTurnLength": 26.0 if candidate == "b" else None,
            "lexicalDiversity": 0.61 if candidate == "b" else None,
            "grammarErrorsPer100Words": 2.0 if candidate == "b" else None,
            "cefrEstimate": "B2" if candidate == "b" else None,
        },
        "interviewQuestions": questions,
        "candidateFeedback": feedback,
    }


def export_seed() -> None:
    a_dir = SEED / "a"
    shutil.copyfile(EXAMPLES / "brief.response.json", a_dir / "expected-brief.json")
    shutil.copyfile(
        EXAMPLES / "simulation-assessment.response.json",
        a_dir / "expected-assessment.json",
    )
    a_request = json.loads(
        (EXAMPLES / "simulation-assessment.request.json").read_text(encoding="utf-8")
    )
    write(a_dir / "transcript.json", a_request["turns"])

    synthetic_turns = {
        "b": [
            turn("turn_01", "character", "The mentoring pilot has stopped. What now?", 0),
            turn("turn_02", "candidate", "I paused until a teammate helped me restart the discussion.", 1),
            turn("turn_03", "character", "How would you change the pilot?", 2),
            turn("turn_04", "candidate", "I would test one small group first and ask beginners what made them leave.", 3),
            turn("turn_05", "character", "What is the larger goal?", 4),
            turn("turn_06", "candidate", "The goal is a path from first practice to confident participation, not just attendance.", 5),
            turn("turn_07", "character", "What boundary matters?", 6),
            turn("turn_08", "candidate", "Beginners choose what feedback is shared, and mentors cannot publish private notes.", 7),
            turn("turn_09", "character", "What happens next?", 8),
            turn("turn_10", "candidate", "I will recruit two mentors this week and review the first group after a month.", 9),
        ],
        "c": [
            turn("turn_01", "character", "The group is waiting for a plan. What do you do?", 0),
            turn("turn_02", "candidate", "I would probably make a good plan, but I cannot think of a similar situation.", 1),
        ],
    }
    for candidate, turns in synthetic_turns.items():
        directory = SEED / candidate
        snapshot = json.loads((directory / "snapshot.json").read_text(encoding="utf-8"))
        write(directory / "expected-brief.json", brief(candidate, snapshot))
        write(directory / "transcript.json", turns)
        write(directory / "expected-assessment.json", assessment(candidate, turns))

    for candidate, candidate_id in CANDIDATE_IDS.items():
        directory = SEED / candidate
        write(
            directory / "interview-notes.json",
            [
                {
                    "id": f"note-{candidate}-01",
                    "text": f"Synthetic note for candidate {candidate.upper()}; verify examples against the transcript.",
                }
            ],
        )
        values = (
            {"D": 3, "R": 2, "I": 2, "V": None, "E": 3}
            if candidate == "a"
            else {"D": 1, "R": 3, "I": 4, "V": 3, "E": 2}
            if candidate == "b"
            else {code: None for code in "DRIVE"}
        )
        write(
            directory / "interviewer-scores.json",
            {
                "interviewId": f"00000000-0000-4000-9000-00000000000{candidate}",
                "candidateId": candidate_id,
                "scores": values,
                "savedAt": "2026-09-26T10:40:00Z",
            },
        )

    history = []
    for index in range(6):
        history.append(
            {
                "interviewRef": f"synthetic-interview-{index + 1:02d}",
                "interviewerRef": "synthetic-interviewer-a" if index < 3 else "synthetic-interviewer-b",
                "heldAt": f"2026-09-{10 + index:02d}T09:00:00Z",
                "scores": [
                    {"competency": code, "score": min(4, 1 + ((index + offset) % 4))}
                    for offset, code in enumerate("DRIVE")
                ],
            }
        )
    write(ROOT / "seed" / "quality-history.json", history)


if __name__ == "__main__":
    export_seed()
