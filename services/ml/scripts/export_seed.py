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
    focus_questions = {
        "D": "After a setback, what did you do for the people involved?",
        "R": "Describe a decision with a risk. What alternatives did you weigh?",
        "I": "What need did your idea address, and how did you test it?",
        "V": "Describe a time fairness changed your plan. What did you choose?",
        "E": "How did you divide responsibility and check that the plan worked?",
        "invision_knowledge": "What do you know about how inVision U teaches?",
        "english": "In English, describe a recent project without preparing.",
        "motivation": "Why did you choose to apply to inVision U?",
    }
    questions = []
    for focus in FOCUSES:
        answer = answers[focus_fields[focus]]
        questions.append(
            {
                "focus": focus,
                "question": focus_questions[focus],
                "why": "The cited response is worth exploring in the interview.",
                "evidence": [
                    {
                        "source": "application_field",
                        "sourceId": answer["fieldId"],
                        "quote": answer["answer"],
                    }
                ],
            }
        )
    english_self = answers.get("english_self")
    rating = english_self["answer"].split(".", 1)[0].upper() if english_self else None
    consistency = []
    if rating in {"A1", "A2", "B1", "B2", "C1", "C2"}:
        simulation_english = (
            json.loads((EXAMPLES / "brief.request.json").read_text(encoding="utf-8"))
            ["simulationEnglish"] if candidate == "a" else None
        )
        measured = simulation_english["cefrEstimate"] if simulation_english else None
        consistency.append({
            "itemId": "c_01",
            "topic": "english",
            "claim": {
                "text": f"Self-rated English as {rating}.",
                "evidence": [{
                    "source": "application_field", "sourceId": "english_self", "quote": rating,
                }],
            },
            "observation": {
                "text": (
                    f"Simulation English was estimated at {measured}." if measured
                    else "No simulation English estimate is available yet."
                ),
                "evidence": [],
                "metric": (
                    {"name": "cefrEstimate", "value": measured, "source": "simulation"}
                    if measured else None
                ),
            },
            "status": (
                "unverified" if not measured
                else "consistent" if rating == measured else "discrepancy"
            ),
            "whatToDo": "Ask an unprepared English question and review the evidence together.",
            "askInInterview": "In English, describe a recent project and an unexpected problem you solved.",
        })
    certificate = snapshot.get("englishCertificate")
    return {
        "summary": "Interview preparation based on the supplied application and test responses.",
        "questions": questions,
        "consistency": consistency,
        "clarify": [],
        "english": {
            "certificate": (
                {"type": certificate["type"], "score": certificate["score"], "cefr": "B2"}
                if certificate else None
            ),
            "writtenCefr": "B1+" if candidate == "a" else "B2" if candidate == "b" else "B1",
            "basis": "Estimate based on supplied written application answers; verify live.",
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
    candidate_turns = {
        item["turnId"]: item["text"]
        for item in turns
        if item["speaker"] == "candidate"
    }
    if candidate == "b":
        scores = [
            score("D", 1, "turn_10", candidate_turns["turn_10"]),
            score("R", 2, "turn_04", candidate_turns["turn_04"]),
            score("I", 4, "turn_08", "After the demo we will keep reviews so nobody loses ownership again."),
            score("V", 2, "turn_06", candidate_turns["turn_06"]),
            score("E", 3, "turn_08", "We assign owners now, freeze by Thursday, and run the full demo at six."),
        ]
        for item, rationale in zip(
            scores,
            (
                "Responds to the failed run by demanding more work without a recovery sequence.",
                "Protects ownership with a review rule but leaves the tradeoff and rollout unclear.",
                "Connects today's conflict to a lasting review practice after the demo.",
                "Protects Dana but leaves Timur outside the conversation.",
                "Names owners, a freeze deadline, and a full-run checkpoint.",
            ),
            strict=True,
        ):
            item["rationale"] = rationale
        questions = [
            {
                "competency": "D",
                "question": "If the extra night of work fails, how would you reset the plan and protect the team?",
                "reason": "The response to the failed run did not include a workable recovery sequence.",
            }
        ]
        feedback = {
            "strengths": ["You connected today's conflict to a longer-term review practice."],
            "growth": ["When a run fails, protect the team's energy while choosing what to fix."],
            "nextTime": ["Name a recovery checkpoint before extending anyone's work."],
        }
    else:
        scores = [
            score("D", 1, "turn_08", candidate_turns["turn_08"]),
            score("R", None, "", ""),
            score("I", None, "", ""),
            score("V", 0, "turn_08", candidate_turns["turn_08"]),
            score("E", 0, "turn_06", candidate_turns["turn_06"]),
        ]
        scores[0]["rationale"] = "Pushes through the setback without a recovery sequence."
        scores[3]["rationale"] = "Demands exhausting work after first recognizing the teammate's concern."
        scores[3]["evidence"].insert(
            0,
            {
                "source": "simulation_turn",
                "sourceId": "turn_02",
                "quote": candidate_turns["turn_02"],
            },
        )
        scores[4]["rationale"] = "Passes the decision to teammates without an owned next step."
        questions = [
            {
                "competency": code,
                "question": f"Tell me about a specific situation where you demonstrated {code}.",
                "reason": "There is not enough verified behavioral evidence yet.",
            }
            for code in "RI"
        ]
        feedback = {
            "strengths": ["You first invited the teammate to explain what happened."],
            "growth": ["When pressure rises, keep that concern in the plan for everyone involved."],
            "nextTime": ["Name a workable next step and who will carry it out."],
        }
    return {
        "scores": scores,
        "english": {
            "wordsPerMinute": None,
            "fillerRate": None,
            "meanTurnLength": None,
            "lexicalDiversity": None,
            "grammarErrorsPer100Words": None,
            "cefrEstimate": None,
        },
        "interviewQuestions": questions,
        "candidateFeedback": feedback,
    }


def export_seed() -> None:
    a_dir = SEED / "a"
    a_snapshot = json.loads((a_dir / "snapshot.json").read_text(encoding="utf-8"))
    write(a_dir / "expected-brief.json", brief("a", a_snapshot))
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
            turn("turn_01", "character", "Timur replaced my module without asking. I want to leave this team.", 0),
            turn("turn_02", "candidate", "Let's fix this fast, the demo is in three days.", 1),
            turn("turn_03", "character", "How do I know this will not happen again?", 2),
            turn("turn_04", "candidate", "From now on nobody changes someone's module without their review.", 3),
            turn("turn_05", "character", "Will you make Timur the villain for this?", 4),
            turn("turn_06", "candidate", "I'll talk to him myself, you focus on work.", 5),
            turn("turn_07", "character", "Who decides which version we keep for the demo?", 6),
            turn("turn_08", "candidate", "We assign owners now, freeze by Thursday, and run the full demo at six. After the demo we will keep reviews so nobody loses ownership again.", 7),
            turn("turn_09", "character", "The Thursday run failed. What now?", 8),
            turn("turn_10", "candidate", "We'll work all night and fix it.", 9),
            turn("turn_11", "character", "I will stay for the demo, but the team needs a safer recovery plan.", 10),
        ],
        "c": [
            turn("turn_01", "character", "Timur replaced my module without asking. I want to leave this team.", 0),
            turn("turn_02", "candidate", "You're right to be angry. Walk me through it.", 1),
            turn("turn_03", "character", "How do I know this will not happen again?", 2),
            turn("turn_04", "candidate", "It won't happen again, I promise.", 3),
            turn("turn_05", "character", "What is your concrete plan for the demo?", 4),
            turn("turn_06", "candidate", "You two decide between you.", 5),
            turn("turn_07", "character", "The Thursday run failed. What now?", 6),
            turn("turn_08", "candidate", "Everyone stays until it works.", 7),
            turn("turn_09", "character", "I cannot agree to work without a limit. We need another plan.", 8),
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
