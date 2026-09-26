"""M5 process-quality route orchestration with no candidate judgment."""

from __future__ import annotations

from ..errors import ServiceError
from ..schemas.contracts import QualityCheckRequest, QualityCheckResult
from .quality_calibration import CalibrationWording, compute_drift, talk_share
from .quality_guard import InterviewQuestionAnalyzer, interviewer_sources, load_quality_policy


class QualityCheckService:
    def __init__(
        self, question_analyzer: InterviewQuestionAnalyzer,
        calibration_wording: CalibrationWording,
    ) -> None:
        self._question_analyzer = question_analyzer
        self._calibration_wording = calibration_wording
        self._policy = load_quality_policy()

    async def prepare(self, request: QualityCheckRequest) -> QualityCheckResult:
        if request.kind == "interview":
            try:
                questions = interviewer_sources(request.transcript)
            except ValueError as error:
                raise ServiceError(
                    status_code=422, code="VALIDATION_ERROR",
                    message="Interview source identifiers are ambiguous.",
                ) from error
            signals = (
                await self._question_analyzer.analyze(request) if questions else []
            )
            return QualityCheckResult(
                signals=signals, talkShare=talk_share(request.transcript),
            )

        drift, selected, interviews = compute_drift(request, self._policy)
        signals = await self._calibration_wording.write(selected)
        return QualityCheckResult(
            signals=signals, drift=drift, interviews=interviews,
        )
