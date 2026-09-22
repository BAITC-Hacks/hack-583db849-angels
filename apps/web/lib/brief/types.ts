import type { EvidenceSource } from '../../components/evidence/EvidenceQuote';
import type { Competency } from '../drive';

export interface BriefEvidence {
  quote: string;
  source: EvidenceSource;
}

/**
 * What the interviewer brief renders. The screen's own shape, not a wire type;
 * part 2 maps the generated client onto it once the briefs contract lands (#12).
 */
export interface InterviewerBrief {
  candidate: { id: string; code: 'A' | 'B' | 'C' };
  application: { fieldId: string; question: string; answer: string }[];
  test: { itemId: string; response: string }[];
  summary: string;
  /** One or more per competency. No evidence means the application is silent — that is why it is asked. */
  questions: { competency: Competency; question: string; why: string; evidence: BriefEvidence[] }[];
  /** Two sources that disagree. To clarify, never a verdict. */
  flags: { title: string; ask: string; sources: [BriefEvidence, BriefEvidence] }[];
  clarify: { topic: string; evidence: BriefEvidence[] }[];
  english: { certificate: string; certificateCefr: string; writtenCefr: string; basis: string };
}
