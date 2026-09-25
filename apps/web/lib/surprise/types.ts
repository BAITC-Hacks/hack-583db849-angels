import type { Competency } from '../drive';

export type SurpriseStatus = 'ready' | 'started' | 'transcribing' | 'answered' | 'failed';

export interface SurpriseSegment {
  segmentId: string;
  text: string;
  startSec: number;
  endSec: number;
}

/**
 * One unexpected question about the candidate's own application, answered on
 * camera in ninety seconds, once.
 *
 * `question` is null until the candidate asks for it: a question they could
 * read in advance is a question they could rehearse. `answerDeadline` is the
 * server's, and the screen only counts down to it — the rule lives on the
 * server, not in the browser.
 *
 * The staff fields (`competency`, `why`, `segments`, `videoAvailable`) never
 * reach the candidate at all.
 */
export interface SurpriseQuestion {
  surpriseId: string;
  candidateId: string;
  status: SurpriseStatus;
  question: string | null;
  answerSeconds: number;
  startedAt: string | null;
  answerDeadline: string | null;
  competency?: Competency;
  why?: string;
  segments?: SurpriseSegment[] | null;
  videoAvailable?: boolean;
}

/** What staff read of an answer: the question, why it was asked and what was said. */
export type SurpriseAnswerView = Pick<SurpriseQuestion, 'question' | 'competency' | 'why' | 'segments' | 'videoAvailable'>;
