import type { EvidenceSource } from '../../components/evidence/EvidenceQuote';

export interface ConsistencyEvidence {
  quote: string;
  source: EvidenceSource;
}

export type ConsistencyTopic = 'english' | 'invision_knowledge' | 'motivation' | 'experience' | 'achievements' | 'other';

/**
 * Before the interview an item is open: it matches, it does not, or there is
 * nothing to compare it with yet. After the interview it is settled — the
 * interview confirmed the discrepancy, or cleared it up — unless nobody asked,
 * in which case it honestly stays unverified.
 */
export type ConsistencyStatus = 'consistent' | 'discrepancy' | 'unverified' | 'confirmed' | 'resolved';

/**
 * One thing the candidate said about themselves, against what was measured or
 * heard. A signal with its evidence, never a verdict and never a score.
 */
export interface ConsistencyItem {
  itemId: string;
  topic: ConsistencyTopic;
  claim: { text: string; evidence: ConsistencyEvidence[] };
  observation: {
    text: string;
    evidence: ConsistencyEvidence[];
    /** A measured value, such as the CEFR estimate from the simulation's speech. */
    metric: { name: string; value: string | number; source: 'simulation' | 'surprise' | 'interview' } | null;
  };
  status: ConsistencyStatus;
  whatToDo: string;
  /** Before the interview only: the question that would settle it. */
  askInInterview: string | null;
}

export interface ConsistencyReport {
  candidateId: string;
  stage: 'before' | 'after';
  createdAt: string;
  items: ConsistencyItem[];
}
