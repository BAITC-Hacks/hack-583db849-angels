'use client';

import { useEffect } from 'react';
import { markBriefViewed } from '../../lib/brief/viewed';

/** Tells the interviewer's home, in this tab only, that the brief has been opened (G13). */
export function MarkBriefViewed({ candidateId }: { candidateId: string }) {
  useEffect(() => {
    markBriefViewed(candidateId);
  }, [candidateId]);
  return null;
}
