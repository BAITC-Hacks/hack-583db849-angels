"""What a model is shown of a request: its content, never what changes from run to run.

Cassettes and the cache are keyed by the model request. A turn's timing and the
candidate's technical id differ between the API and the replay scripts, so a
request carrying them never finds its cassette in `replay`. Neither helps the
model: timing is read only by the English metrics, in code, and the id is
never part of an answer.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from ..schemas.contracts import BriefRequest, InterviewTurn, Turn


def model_turns(turns: Sequence[Turn]) -> list[dict[str, Any]]:
    return [{"turnId": turn.turnId, "speaker": turn.speaker, "text": turn.text} for turn in turns]


def model_interview_turns(turns: Sequence[InterviewTurn]) -> list[dict[str, Any]]:
    """Keep citeable turn ids and speech, but not API/STT timing metadata."""

    return [{"turnId": turn.turnId, "speaker": turn.speaker, "text": turn.text} for turn in turns]


def model_brief_request(request: BriefRequest) -> dict[str, Any]:
    return request.model_dump(mode="json", exclude={"candidate": {"candidateId"}})
