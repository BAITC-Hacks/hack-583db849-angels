'use client';

import { useQuery } from '@tanstack/react-query';
import type { CandidateCode } from '../demo/world';
import { api, unwrap } from './client';
import type { WireCandidate } from './contract';
import { codeFromLabel } from './mappers/evidence';

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

/** A step the homes are waiting on: a simulation still running, or an assessment being written. */
export function somethingPending(candidates: WireCandidate[] | undefined): boolean {
  return Boolean(
    candidates?.some(
      (candidate) => candidate.progress?.simulation?.status === 'active' || candidate.progress?.assessment?.status === 'pending',
    ),
  );
}

export function candidateByCode(candidates: WireCandidate[] | undefined, code: CandidateCode): WireCandidate | undefined {
  return candidates?.find((candidate) => codeFromLabel(candidate.label) === code);
}
