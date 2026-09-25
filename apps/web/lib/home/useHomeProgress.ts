'use client';

import { candidateByCode, useCandidates } from '../api/candidates';
import { toScreenProgress } from '../api/mappers/candidates';
import { useViewedBriefs } from '../brief/viewed';
import type { CandidateCode, CandidateProgress } from './types';

const codes: CandidateCode[] = ['A', 'B', 'C'];

export interface HomeProgress {
  candidates: Record<CandidateCode, CandidateProgress>;
  /** The API could not be read; every step shows as not started. */
  apiError: unknown;
}

function notStarted(code: CandidateCode): CandidateProgress {
  return {
    code, id: '', hasData: false, brief: null, briefViewed: false, simulation: 'not-started', assessmentReady: false,
    assessment: null, interviewId: null, transcript: 'none', scoresSaved: false, draftReady: false,
  };
}

/**
 * Where each candidate is, for the staff homes — all of it from
 * `GET /v1/candidates?include=progress`, polled while a step is pending,
 * with the candidate's id every link needs. Whether the brief was opened is
 * the one thing only this tab knows (G13).
 */
export function useHomeProgress(): HomeProgress {
  const viewed = useViewedBriefs();
  const api = useCandidates({ poll: 'while-pending' });

  const candidates = Object.fromEntries(
    codes.map((code) => {
      const progress = candidateByCode(api.data, code)?.progress;
      if (!progress) return [code, notStarted(code)];
      const fromApi = toScreenProgress(progress);
      const brief = progress.brief?.status;
      return [
        code,
        {
          ...fromApi,
          code,
          brief: brief === 'pending' || brief === 'ready' || brief === 'failed' ? brief : null,
          briefViewed: viewed.has(fromApi.id),
          assessment: (progress.assessment?.status as CandidateProgress['assessment']) ?? null,
        },
      ];
    }),
  ) as Record<CandidateCode, CandidateProgress>;

  return { candidates, apiError: api.isError ? api.error : null };
}
