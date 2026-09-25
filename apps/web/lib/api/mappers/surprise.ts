import type { components } from '@invision/api-client';
import type { SurpriseQuestion } from '../../surprise/types';

type WireSurprise = components['schemas']['SurpriseQuestionDto'];

/**
 * The surprise question as a screen reads it. The staff fields arrive only for
 * staff: for the candidate's channel they are absent on the wire, and stay
 * absent here rather than turning into empty values.
 */
export function toSurpriseQuestion(wire: WireSurprise): SurpriseQuestion {
  const surprise: SurpriseQuestion = {
    surpriseId: wire.surpriseId,
    candidateId: wire.candidateId,
    status: wire.status,
    question: wire.question,
    answerSeconds: wire.answerSeconds,
    startedAt: wire.startedAt,
    answerDeadline: wire.answerDeadline,
  };
  if (wire.competency !== undefined) surprise.competency = wire.competency;
  if (wire.why !== undefined) surprise.why = wire.why;
  if (wire.segments !== undefined) surprise.segments = wire.segments;
  if (wire.videoAvailable !== undefined) surprise.videoAvailable = wire.videoAvailable;
  return surprise;
}
