'use client';

import { candidateById, useCandidates } from '../../lib/api/candidates';
import { surpriseVideoUrl, useSurprise } from '../../lib/surprise/queries';
import { SurpriseAnswer } from './SurpriseAnswer';

/**
 * The "Surprise answer" block for staff, wherever they read about a candidate
 * — the brief and the commission report. It appears once the candidate has a
 * question, follows it while the answer is transcribed, and plays the video
 * only on request.
 */
export function CandidateSurprise({ candidateId }: { candidateId: string }) {
  const candidates = useCandidates();
  const surpriseId = candidateById(candidates.data, candidateId)?.progress?.surprise?.surpriseId ?? null;
  const surprise = useSurprise(surpriseId, { poll: true });

  if (!surpriseId || !surprise.data) return null;
  return <SurpriseAnswer surprise={surprise.data} videoUrl={surpriseVideoUrl(surpriseId)} />;
}
