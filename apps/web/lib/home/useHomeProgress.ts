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
 * in the API — the brief, the simulation and its assessment — come from
 * `GET /v1/candidates?include=progress`, polled while one is pending, and so
 * does the candidate's id, which every link to those screens needs. Whether
 * the brief was opened is only ever known to this tab (G13), and the
 * interview still comes from the demo world until #14 moves it.
 */
export function useHomeProgress(): HomeProgress {
  const world = useWorld();
  const api = useCandidates({ poll: 'while-pending' });

  const candidates = Object.fromEntries(
    codes.map((code) => {
      const local = world.candidates[code];
      const progress = candidateByCode(api.data, code)?.progress;
      if (!progress) return [code, { ...local, brief: null, simulation: 'not-started', assessmentReady: false }];
      const fromApi = toScreenProgress(progress);
      const brief = progress.brief?.status;
      return [
        code,
        {
          ...local,
          id: fromApi.id,
          brief: brief === 'pending' || brief === 'ready' || brief === 'failed' ? brief : null,
          simulation: fromApi.simulation,
          assessmentReady: fromApi.assessmentReady,
          assessment: (progress.assessment?.status as CandidateProgress['assessment']) ?? null,
          hasData: local.hasData || fromApi.hasData,
        },
      ];
    }),
  ) as Record<CandidateCode, CandidateProgress>;

  return { candidates, apiError: api.isError ? api.error : null };
}
