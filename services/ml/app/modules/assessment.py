"""M3 assessment pipeline behind the frozen internal response schema."""

from __future__ import annotations

import asyncio

from ..errors import ServiceError
from ..metrics.english import GrammarChecker, compute_english_metrics
from ..metrics.languagetool import LocalGrammarError
from ..scenarios import ScenarioRepository
from ..schemas.contracts import AssessmentRequest, AssessmentResult
from .assessment_text import AssessmentText
from .judge import SimulationJudge


class AssessmentService:
    def __init__(
        self,
        scenarios: ScenarioRepository,
        judge: SimulationJudge,
        grammar_checker: GrammarChecker,
        text: AssessmentText | None = None,
    ) -> None:
        self._scenarios = scenarios
        self._judge = judge
        self._grammar_checker = grammar_checker
        self._text = text or AssessmentText()

    async def assess(self, request: AssessmentRequest) -> AssessmentResult:
        if self._scenarios.get(request.scenarioId) is None:
            raise ServiceError(
                status_code=404,
                code="SCENARIO_NOT_FOUND",
                message="Scenario not found.",
            )
        candidate_turns = [turn for turn in request.turns if turn.speaker == "candidate"]
        if not candidate_turns or len({turn.turnId for turn in request.turns}) != len(request.turns):
            raise ServiceError(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Assessment transcript is invalid.",
            )

        scores = await self._judge.judge(request)
        try:
            english = await asyncio.to_thread(
                compute_english_metrics, request, self._grammar_checker
            )
        except LocalGrammarError as error:
            raise ServiceError(
                status_code=503,
                code="AI_UNAVAILABLE",
                message="Local language analysis is unavailable.",
            ) from error
        questions, feedback = self._text.generate(scores)
        return AssessmentResult(
            scores=scores,
            english=english,
            interviewQuestions=questions,
            candidateFeedback=feedback,
        )
