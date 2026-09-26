'use client';

import { useQuery } from '@tanstack/react-query';
import type { CandidateCode } from '../home/types';
import { api, unwrap } from './client';
import type { WireCandidate } from './contract';
import { seedCode } from './mappers/evidence';
import { useDemoCandidateId } from '../demo/currentCandidate';

export const candidatesKey = ['candidates'] as const;

/**
 * The seeded candidates, each with where they are, as the API says. The API
 * filters the steps by the caller's role, so a step this role may not see
 * arrives as `null`. A home polls while a step is pending — every 5 seconds,
 * as `docs/contracts/api.md` asks.
 */
export function useCandidates({ poll = false }: { poll?: boolean | 'while-pending' } = {}) {
  return useQuery({
    queryKey: candidatesKey,
    queryFn: async () => {
      const result = await api.GET('/v1/candidates', { params: { query: { include: 'progress' } } });
      return unwrap(result).items as unknown as WireCandidate[];
    },
    refetchInterval: (query) => {
      if (poll === 'while-pending') return somethingPending(query.state.data) ? 5_000 : false;
      return poll ? 5_000 : false;
    },
  });
}

/** A step the screens are waiting on: a brief, an assessment or the after-interview consistency being written, or a simulation still running. */
export function somethingPending(candidates: WireCandidate[] | undefined): boolean {
  return Boolean(
    candidates?.some(
      (candidate) =>
        candidate.progress?.brief?.status === 'pending' ||
        candidate.progress?.simulation?.status === 'active' ||
        candidate.progress?.assessment?.status === 'pending' ||
        candidate.progress?.consistency?.after === 'pending',
    ),
  );
}

export function candidateById(candidates: WireCandidate[] | undefined, candidateId: string): WireCandidate | undefined {
  return candidates?.find((candidate) => candidate.candidateId === candidateId);
}

export function candidateByCode(candidates: WireCandidate[] | undefined, code: CandidateCode): WireCandidate | undefined {
  return candidates?.find((candidate) => seedCode(candidate.label) === code);
}

/**
 * The candidate the candidate screens belong to: the one the demo cookie names
 * (an applicant the stand sent, or one the presenter picked), else candidate A.
 */
export function useMe(options: { poll?: boolean | 'while-pending' } = {}) {
  const candidates = useCandidates(options);
  const chosen = useDemoCandidateId();
  const me = (chosen ? candidateById(candidates.data, chosen) : undefined) ?? candidateByCode(candidates.data, 'A');
  return { candidates, me };
}
