'use client';

import type { components } from '@invision/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { candidatesKey } from '../api/candidates';
import { api, unwrap } from '../api/client';

export type AdminOverview = components['schemas']['AdminOverviewDto'];
export type AuditEvent = components['schemas']['AuditEventDto'];

export const overviewKey = ['admin', 'overview'] as const;
export const auditKey = ['admin', 'audit'] as const;

/** The demo at a glance, refreshed every 10 seconds. */
export function useAdminOverview() {
  return useQuery({
    queryKey: overviewKey,
    queryFn: async () => unwrap(await api.GET('/v1/admin/overview')),
    refetchInterval: 10_000,
  });
}

/** The newest 50 events, refreshed every 5 seconds: what happened, in any role. */
export function useAuditEvents() {
  return useQuery({
    queryKey: auditKey,
    queryFn: async () => unwrap(await api.GET('/v1/audit-events', { params: { query: { limit: 50 } } })).items,
    refetchInterval: 5_000,
  });
}

/** Starts the demo over. Every cached answer is stale after it, so all of them are asked for again. */
export function useDemoReset() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await api.POST('/v1/demo/reset');
      if (!result.response.ok) unwrap(result);
    },
    onSuccess: () => void client.invalidateQueries(),
  });
}

/** Completes a seed candidate's simulation from the recording and starts its assessment. */
export function useRecordedSession() {
  const client = useQueryClient();
  const key = useRef<string | null>(null);
  return useMutation({
    mutationFn: async (candidateId: string) => {
      key.current ??= crypto.randomUUID();
      return unwrap(await api.POST('/v1/demo/recorded-session', { body: { candidateId }, headers: { 'Idempotency-Key': key.current } }));
    },
    onSuccess: () => {
      key.current = null;
      void client.invalidateQueries({ queryKey: candidatesKey });
      void client.invalidateQueries({ queryKey: auditKey });
      void client.invalidateQueries({ queryKey: overviewKey });
    },
  });
}
