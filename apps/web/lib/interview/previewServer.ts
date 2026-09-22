import { competencyOrder } from '../drive';
import type { AssessmentDraft, InterviewTurn, InterviewerScores } from './types';

/** The server's answer to a draft request before the interviewer has scored. */
export class DraftLockedError extends Error {
  readonly status = 409;
  readonly code = 'DRAFT_LOCKED';
  constructor() {
    super("Save the interviewer's scores first.");
  }
}

/** The draft is written from the transcript; without one there is nothing to write from. */
export class TranscriptMissingError extends Error {
  readonly status = 409;
  readonly code = 'TRANSCRIPT_MISSING';
  constructor() {
    super('Add the interview recording or transcript first.');
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
 * Stands in for the interviews API (#15) and keeps its rules: the draft does
 * not exist for the client until the interviewer's own scores are saved, those
 * scores cannot change afterwards, and a draft needs a transcript.
 *
 * `transcribe` stands in for uploading the recording: in the preview the audio
 * never leaves the browser and the scripted transcript comes back instead.
 */
export class PreviewInterviewServer {
  private saved: InterviewerScores | null = null;
  private transcript: InterviewTurn[] | null = null;

  constructor(
    private readonly draft: AssessmentDraft,
    private readonly scripted: InterviewTurn[],
    private readonly delayMs = 700,
  ) {}

  async transcribe(): Promise<InterviewTurn[]> {
    await wait(this.delayMs * 2);
    this.transcript = this.scripted;
    return this.transcript;
  }

  async saveScores(scores: InterviewerScores): Promise<InterviewerScores> {
    if (this.saved) return this.saved;
    if (competencyOrder.some((competency) => scores[competency] === undefined)) throw new IncompleteScoresError();
    await wait(this.delayMs);
    this.saved = { ...scores };
    return this.saved;
  }

  async getDraft(): Promise<AssessmentDraft> {
    if (!this.saved) throw new DraftLockedError();
    if (!this.transcript) throw new TranscriptMissingError();
    await wait(this.delayMs / 2);
    return this.draft;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
