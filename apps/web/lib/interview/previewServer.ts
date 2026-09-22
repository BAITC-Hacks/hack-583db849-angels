import { competencyOrder } from '../drive';
import type { AssessmentDraft, InterviewerScores } from './types';

/** The server's answer to a draft request before the interviewer has scored. */
export class DraftLockedError extends Error {
  readonly status = 409;
  readonly code = 'DRAFT_LOCKED';
  constructor() {
    super("Save the interviewer's scores first.");
  }
}

export class IncompleteScoresError extends Error {
  readonly status = 400;
  readonly code = 'VALIDATION_ERROR';
  constructor() {
    super('Every competency needs a score or "not enough to judge".');
  }
}

/**
 * Stands in for the interviews API (#15) and keeps its rule: the draft does
 * not exist for the client until the interviewer's own scores are saved, and
 * those scores cannot change afterwards.
 */
export class PreviewInterviewServer {
  private saved: InterviewerScores | null = null;

  constructor(
    private readonly draft: AssessmentDraft,
    private readonly delayMs = 700,
  ) {}

  async saveScores(scores: InterviewerScores): Promise<InterviewerScores> {
    if (this.saved) return this.saved;
    if (competencyOrder.some((competency) => scores[competency] === undefined)) throw new IncompleteScoresError();
    await wait(this.delayMs);
    this.saved = { ...scores };
    return this.saved;
  }

  async getDraft(): Promise<AssessmentDraft> {
    if (!this.saved) throw new DraftLockedError();
    await wait(this.delayMs / 2);
    return this.draft;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
