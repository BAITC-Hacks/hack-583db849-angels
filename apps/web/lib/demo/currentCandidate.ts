'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which candidate the candidate screens show. In production the platform
 * signs the applicant in; in the demo it is a cookie: set when the stand
 * sends an application (the applicant carries on as themselves), or when the
 * presenter picks A, B, C or a stand applicant in the sidebar. Without it the
 * screens show candidate A, the pitch's own.
 */
export const DEMO_CANDIDATE_COOKIE = 'invision-demo-candidate';

const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_CANDIDATE_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setDemoCandidate(candidateId: string | null): void {
  document.cookie = candidateId
    ? `${DEMO_CANDIDATE_COOKIE}=${encodeURIComponent(candidateId)}; path=/; max-age=31536000; samesite=lax`
    : `${DEMO_CANDIDATE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The chosen candidate's id, or `null` for "candidate A". Always `null` on the server. */
export function useDemoCandidateId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
