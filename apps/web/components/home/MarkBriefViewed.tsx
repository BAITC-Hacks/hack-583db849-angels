'use client';

import { useEffect } from 'react';
import { record, type CandidateCode } from '../../lib/demo/world';

/**
 * Tells the interviewer's home, in this tab only, that the brief has been
 * opened. The server keeps no "read" mark (`docs/INTEGRATION.md`, G13).
 */
export function MarkBriefViewed({ code }: { code: CandidateCode }) {
  useEffect(() => {
    record('brief-viewed', code, { briefViewed: true });
  }, [code]);
  return null;
}
