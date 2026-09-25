'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { candidatesKey } from '../api/candidates';
import { api, unwrap } from '../api/client';
import type { WireCandidateProgress } from '../api/contract';
import { toInterviewerBrief } from '../api/mappers/brief';

export const briefKey = (candidateId: string) => ['brief', candidateId] as const;

/**
 * The candidate's latest ready brief. Until the first one is ready the API
 * answers `404 BRIEF_NOT_FOUND`, and `progress.brief` — polled by the
 * candidates list while it is pending — says why. When that poll sees a newer
 * brief become ready, it is read at once.
 */
export function useBrief(candidateId: string, progress: WireCandidateProgress['brief'] | undefined) {
  const query = useQuery({
    queryKey: briefKey(candidateId),
    queryFn: async () => {
      const result = await api.GET('/v1/candidates/{candidateId}/brief', { params: { path: { candidateId } } });
      return toInterviewerBrief(unwrap(result));
    },
  });

  const readyId = progress?.status === 'ready' ? progress.briefId : null;
  const shownId = query.data?.briefId;
  const { refetch } = query;
  useEffect(() => {
    if (readyId && readyId !== shownId) void refetch({ cancelRefetch: false });
  }, [readyId, shownId, refetch]);

  return query;
}

/**
 * The admin's re-run. It waits for the model, so it can fail with `502/503
 * AI_*`; "Try again" sends the same `Idempotency-Key`, and a new one is made
 * only after a success.
 */
export function useRerunBrief(candidateId: string) {
  const client = useQueryClient();
  const key = useRef<string | null>(null);

  return useMutation({
    mutationFn: async () => {
      key.current ??= crypto.randomUUID();
      const result = await api.POST('/v1/briefs', { body: { candidateId }, headers: { 'Idempotency-Key': key.current } });
      return toInterviewerBrief(unwrap(result));
    },
    onSuccess: (brief) => {
      key.current = null;
      client.setQueryData(briefKey(candidateId), brief);
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}
