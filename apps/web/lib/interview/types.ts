import type { CompetencyScoreProps } from '../../components/evidence/CompetencyScore';
import type { Score } from '../../components/evidence/ScoreMeter';
import type { Competency } from '../drive';

/** The interviewer's own view, entered before any AI opinion is visible. */
export type InterviewerScores = Record<Competency, Score | undefined>;

/**
 * One stretch of speech in the interview transcript. Referenced by evidence as
 * `interview_turn`; the id is `iturn_` plus a two-digit position.
 */
export interface InterviewTurn {
  turnId: string;
  speaker: 'interviewer' | 'candidate';
  text: string;
  startSec: number;
  endSec: number;
}

export interface InterviewView {
  interviewId: string;
  candidate: { id: string; code: 'A' | 'B' | 'C' };
  heldAt: string;
}

/** What the server returns once the interviewer's scores are saved — and never before. */
export interface AssessmentDraft {
  scores: Omit<CompetencyScoreProps, 'id'>[];
}

export type TranscriptStatus = 'none' | 'transcribing' | 'ready' | 'failed';

/** One interview as the API has it, in the screen's shape. */
export interface InterviewRecord {
  view: InterviewView;
  transcriptStatus: TranscriptStatus;
  /** Empty until the transcript is ready. */
  transcript: InterviewTurn[];
  /** The interviewer's own scores once saved — fixed from then on. */
  savedScores: Record<Competency, Score> | null;
  /** Taken during the call; they feed the draft, and close with the scores. */
  notes: { id: string; text: string }[];
}

