import type { CompetencyScoreProps } from '../../components/evidence/CompetencyScore';
import type { Score } from '../../components/evidence/ScoreMeter';
import type { Competency } from '../drive';

/** The interviewer's own view, entered before any AI opinion is visible. */
export type InterviewerScores = Record<Competency, Score | undefined>;

export interface InterviewNote {
  /** Referenced by evidence as `interview_note`. */
  id: string;
  text: string;
}

export interface InterviewView {
  interviewId: string;
  candidate: { id: string; code: 'A' | 'B' | 'C' };
  heldAt: string;
  notes: InterviewNote[];
}

/** What the server returns once the interviewer's scores are saved — and never before. */
export interface AssessmentDraft {
  scores: Omit<CompetencyScoreProps, 'id'>[];
}
