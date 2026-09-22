import type { CompetencyScoreProps } from '../../components/evidence/CompetencyScore';
import type { EnglishMetrics } from '../../components/evidence/EnglishMetricsPanel';
import type { Competency } from '../drive';
import type { SimulationTurn } from '../simulation/types';

/**
 * What the commission report renders. The screen's own shape, not a wire type:
 * once the assessments contract lands (#9), a mapper fills it from the
 * generated client.
 */
export interface SimulationReport {
  assessmentId: string;
  candidate: { id: string; code: 'A' | 'B' | 'C' };
  scenarioTitle: string;
  mode: 'text' | 'voice';
  completedAt: string;
  durationMinutes: number;
  turns: SimulationTurn[];
  scores: Omit<CompetencyScoreProps, 'id'>[];
  english: EnglishMetrics;
  /** Questions for the live interview, each tied to what the simulation left open. */
  interviewQuestions: { competency: Competency; question: string; reason: string }[];
}

/**
 * What the candidate receives. Developmental notes only: no score, no
 * ranking, nothing about a decision.
 */
export interface CandidateFeedback {
  assessmentId: string;
  scenarioTitle: string;
  strengths: string[];
  growth: string[];
  nextTime: string[];
}
