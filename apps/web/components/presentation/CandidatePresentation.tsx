'use client';

import { candidateById, useCandidates } from '../../lib/api/candidates';
import { presentationVideoUrl, usePresentation } from '../../lib/presentation/queries';
import { PresentationBlock } from './PresentationBlock';

/**
 * The "Video presentation" block for staff, in the brief and the commission
 * report. It appears once the candidate has sent one, follows it while it is
 * transcribed, and plays the video only on request.
 */
export function CandidatePresentation({ candidateId }: { candidateId: string }) {
  const candidates = useCandidates();
  const presentationId = candidateById(candidates.data, candidateId)?.progress?.presentation?.presentationId ?? null;
  const presentation = usePresentation(presentationId);

  if (!presentationId || !presentation.data) return null;
  return <PresentationBlock presentation={presentation.data} videoUrl={presentationVideoUrl(presentationId)} />;
}
