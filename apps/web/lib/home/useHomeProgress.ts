'use client';

import { candidateByCode, useCandidates } from '../api/candidates';
import { toScreenProgress } from '../api/mappers/candidates';
import { useWorld, type CandidateCode, type CandidateProgress } from '../demo/world';

const codes: CandidateCode[] = ['A', 'B', 'C'];

export interface HomeProgress {
  candidates: Record<CandidateCode, CandidateProgress>;
  /** The API could not be read; the steps it owns show as not started. */
  apiError: unknown;
}

/**
 * Where each candidate is, for the staff homes. The steps that already live
 * in the API — the simulation and its assessment — come from
 * `GET /v1/candidates?include=progress`, polled while one is pending. The
 * brief and the interview still come from the demo world until their own
 * slices move them (#11, #14), and then this is the only place that changes.
 */
export function useHomeProgress(): HomeProgress {
  const world = useWorld();
  const api = useCandidates({ poll: 'while-pending' });

  const candidates = Object.fromEntries(
    codes.map((code) => {
      const local = world.candidates[code];
      const progress = candidateByCode(api.data, code)?.progress;
      if (!progress) return [code, { ...local, simulation: 'not-started', assessmentReady: false }];
      const fromApi = toScreenProgress(progress);
      return [
        code,
        {
          ...local,
          simulation: fromApi.simulation,
          assessmentReady: fromApi.assessmentReady,
          assessment: (progress.assessment?.status as CandidateProgress['assessment']) ?? null,
          hasData: local.hasData || fromApi.simulation !== 'not-started',
        },
      ];
    }),
  ) as Record<CandidateCode, CandidateProgress>;

  return { candidates, apiError: api.isError ? api.error : null };
}
