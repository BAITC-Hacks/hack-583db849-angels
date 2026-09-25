import type { components } from '@invision/api-client';
import type { QualityCheck } from '../../quality/types';
import { toEvidence } from './evidence';

type WireQualityCheck = components['schemas']['QualityCheckDto'];

/** A quality check as the panel reads it; the quotes are the interviewer's own questions. */
export function toQualityCheck(wire: WireQualityCheck): QualityCheck {
  return {
    qualityCheckId: wire.qualityCheckId,
    kind: wire.kind,
    createdAt: wire.createdAt,
    interviewId: wire.interviewId,
    interviewerRef: wire.interviewerRef,
    from: wire.from,
    to: wire.to,
    interviews: wire.interviews,
    talkShare: wire.talkShare,
    drift: wire.drift,
    signals: wire.signals.map((signal) => ({
      kind: signal.kind,
      message: signal.message,
      recommendation: signal.recommendation,
      competencies: signal.competencies,
      evidence: signal.evidence.map(toEvidence),
    })),
  };
}
