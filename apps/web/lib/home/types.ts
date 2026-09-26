/** The three seeded demo candidates, by the letter in their label. */
export type CandidateCode = 'A' | 'B' | 'C';
export type SimulationStatus = 'not-started' | 'in-progress' | 'completed';
export type TranscriptStatus = 'none' | 'transcribing' | 'ready';

/** Where one candidate is, as the staff homes show it — all of it from the API but the "read" mark. */
export interface CandidateProgress {
  /** A, B or C for the seeded candidates; `null` for an applicant the platform sent. */
  code: CandidateCode | null;
  /** What the screens print after "Candidate": the letter, or the platform applicant's tag. */
  tag: string;
  id: string;
  /** Anything to show yet: a brief, or a simulation started. */
  hasData: boolean;
  /** Where the brief is. */
  brief?: 'pending' | 'ready' | 'failed' | null;
  /** Opened in this tab. The server keeps no "read" mark (`docs/INTEGRATION.md`, G13). */
  briefViewed: boolean;
  simulation: SimulationStatus;
  assessmentReady: boolean;
  /** The latest assessment, for links straight to its report; `null` until there is one. */
  assessmentId?: string | null;
  /** Shown so a failed assessment is not mistaken for one not started. */
  assessment?: 'pending' | 'ready' | 'failed' | null;
  /** The latest interview; `null` until the interviewer starts one. */
  interviewId?: string | null;
  transcript: TranscriptStatus;
  scoresSaved: boolean;
  draftReady: boolean;
}
