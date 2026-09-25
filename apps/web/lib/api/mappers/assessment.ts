import type { CandidateFeedback, SimulationReport } from '../../report/types';
import type { SimulationTurn } from '../../simulation/types';
import type { WireAssessment, WireCandidateFeedback, WireTurn } from '../contract';
import { codeFromLabel, toCompetencyScore } from './evidence';

function toTurn(turn: WireTurn): SimulationTurn {
  const base = { turnId: turn.turnId, speaker: turn.speaker, text: turn.text };
  return turn.recognitionConfidence === undefined ? base : { ...base, recognitionConfidence: turn.recognitionConfidence };
}

/**
 * The commission report. The transcript travels with the assessment, so every
 * quote can jump to the turn it came from in the same screen — one call, no
 * second request while the reader is already looking at the quote.
 */
export function toSimulationReport(assessment: WireAssessment): SimulationReport {
  return {
    assessmentId: assessment.assessmentId,
    candidate: { id: assessment.candidateId, code: codeFromLabel(assessment.candidateLabel) },
    scenarioTitle: assessment.simulation.scenarioTitle,
    characterName: assessment.simulation.characterName,
    mode: assessment.simulation.mode,
    accommodation: assessment.simulation.accommodation,
    completedAt: assessment.simulation.completedAt,
    durationMinutes: Math.round(assessment.simulation.durationSeconds / 60),
    turns: assessment.simulation.turns.map(toTurn),
    scores: assessment.scores.map(toCompetencyScore),
    english: assessment.english,
    interviewQuestions: assessment.interviewQuestions,
  };
}

/** The only text the candidate reads. It carries no score, and the mapper adds none. */
export function toCandidateFeedback(feedback: WireCandidateFeedback): CandidateFeedback {
  return {
    assessmentId: feedback.assessmentId,
    scenarioTitle: feedback.scenarioTitle,
    strengths: feedback.strengths,
    growth: feedback.growth,
    nextTime: feedback.nextTime,
  };
}
