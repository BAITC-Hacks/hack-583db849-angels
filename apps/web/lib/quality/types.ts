import type { EvidenceSource } from '../../components/evidence/EvidenceQuote';
import type { Competency } from '../drive';

export interface QualityEvidence {
  quote: string;
  source: EvidenceSource;
}

/**
 * What a check found. Never a verdict, and never about a candidate: these are
 * signals about how an interview was run, or how one interviewer's scale sits
 * against the panel's, each with what a person could do next.
 */
export type QualitySignalKind = 'leading_question' | 'off_limits_question' | 'coverage_gap' | 'scale_drift';

export interface QualitySignal {
  kind: QualitySignalKind;
  message: string;
  recommendation: string;
  competencies: Competency[];
  /** Verbatim interviewer turns; empty for coverage and drift, which are arithmetic. */
  evidence: QualityEvidence[];
}

export interface QualityDrift {
  competency: Competency;
  interviewerMean: number;
  panelMean: number;
  delta: number;
}

export interface QualityCheck {
  qualityCheckId: string;
  kind: 'interview' | 'calibration';
  createdAt: string;
  interviewId: string | null;
  interviewerRef: string | null;
  from: string | null;
  to: string | null;
  interviews: number | null;
  /** Share of speaking time in the interview; an interviewer who talks most of it hears least. */
  talkShare: { interviewer: number; candidate: number } | null;
  drift: QualityDrift[];
  signals: QualitySignal[];
}
