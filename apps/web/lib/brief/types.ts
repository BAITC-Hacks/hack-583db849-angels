import type { EvidenceSource } from '../../components/evidence/EvidenceQuote';
import type { ConsistencyItem, ConsistencyTopic } from '../consistency/types';
import type { Competency } from '../drive';

export interface BriefEvidence {
  quote: string;
  source: EvidenceSource;
}

/**
 * What the brief asks about. The five competencies, and three things an
 * interviewer has to settle that no rubric covers: what the candidate knows
 * about inVision U, how good their English really is, and whether the
 * application was sent deliberately or "because it is free".
 */
export type BriefFocus = Competency | 'invision_knowledge' | 'english' | 'motivation';

/**
 * The brief carries the before-interview stage of the consistency layer, and
 * the commission's screen carries both stages. Same item, same words for it,
 * defined once in `lib/consistency/types.ts`.
 */
export type BriefConsistencyItem = ConsistencyItem;
export type { ConsistencyTopic };

/**
 * What the interviewer brief renders. The screen's own shape, not a wire type;
 * part 2 maps the generated client onto it once the briefs contract lands (#12).
 */
export interface InterviewerBrief {
  candidate: { id: string; code: 'A' | 'B' | 'C' };
  application: { fieldId: string; question: string; answer: string }[];
  test: { itemId: string; response: string }[];
  summary: string;
  /** At least one per focus. No evidence means the application is silent — that is why it is asked. */
  questions: { focus: BriefFocus; question: string; why: string; evidence: BriefEvidence[] }[];
  /** Claimed against measured, before the interview. The after-interview stage is the commission's screen. */
  consistency: BriefConsistencyItem[];
  clarify: { topic: string; evidence: BriefEvidence[] }[];
  english: { certificate: { type: string; score: string; cefr: string } | null; writtenCefr: string; basis: string };
}
