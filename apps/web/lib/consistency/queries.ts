'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../api/client';
import { toConsistencyReport } from '../api/mappers/consistency';

export const consistencyKey = (candidateId: string, stage: 'before' | 'after') => ['consistency', candidateId, stage] as const;

/**
 * One stage of the consistency layer. The after stage is asked for only
 * when it is open and ready — before the interviewer's scores it is not in
 * the network at all, not merely hidden.
 */
export function useConsistency(candidateId: string, stage: 'before' | 'after', { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: consistencyKey(candidateId, stage),
    enabled,
    queryFn: async () =>
      toConsistencyReport(
        unwrap(
          await api.GET('/v1/candidates/{candidateId}/consistency', { params: { path: { candidateId }, query: { stage } } }),
        ),
      ),
  });
}
