'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which briefs were opened in this tab. The server deliberately keeps no
 * "read" mark (`docs/INTEGRATION.md`, G13): the interviewer's home only
 * moves on to the interview once the brief has been opened here. It is
 * never written to browser storage, so a reload forgets it.
 */
let viewed: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function markBriefViewed(candidateId: string): void {
  if (viewed.has(candidateId)) return;
  viewed = new Set([...viewed, candidateId]);
  listeners.forEach((listener) => listener());
}

/** For tests: start with nothing opened. */
export function forgetViewedBriefs(): void {
  viewed = new Set();
  listeners.forEach((listener) => listener());
}

export function useViewedBriefs(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => viewed,
    () => viewed,
  );
}
