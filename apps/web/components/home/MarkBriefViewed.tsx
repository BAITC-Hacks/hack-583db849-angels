'use client';

import { useEffect } from 'react';
import { record } from '../../lib/demo/world';

/** Tells the interviewer's home that the brief has been opened. */
export function MarkBriefViewed() {
  useEffect(() => {
    record('brief-viewed', 'A', { briefViewed: true });
  }, []);
  return null;
}
