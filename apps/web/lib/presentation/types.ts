/** One stretch of the presentation's transcript; quoted as `presentation` with the segment id. */
export interface PresentationSegment {
  segmentId: string;
  text: string;
  startSec: number;
  endSec: number;
}

/**
 * The candidate's video presentation, sent once. The transcript and the
 * video are for staff: the candidate's channel sees only the status.
 */
export interface Presentation {
  presentationId: string;
  candidateId: string;
  status: 'transcribing' | 'ready' | 'failed';
  prompt: string;
  durationSec: number;
  submittedAt: string;
  segments?: PresentationSegment[] | null;
  videoAvailable?: boolean;
}

/** Shown before anything exists; the API returns the same words with every presentation. */
export const PRESENTATION_PROMPT =
  'In one to three minutes, in English: why inVision U, and one time you led other people — what you did, and what came of it.';
export const PRESENTATION_MIN_SECONDS = 60;
export const PRESENTATION_MAX_SECONDS = 180;
