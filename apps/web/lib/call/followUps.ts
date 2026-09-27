'use client';

import type { components } from '@invision/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { api, unwrap } from '../api/client';
import { readApiError } from '../api/errors';

export type FollowUp = components['schemas']['FollowUpDto'];
export type FollowUpSuggestion = FollowUp['suggestions'][number];
export const followUpsKey = (interviewId: string) => ['follow-ups', interviewId] as const;

export function useFollowUps(interviewId: string, enabled: boolean) {
  return useQuery({
    queryKey: followUpsKey(interviewId), enabled, retry: false,
    queryFn: async () => unwrap(await api.GET('/v1/interviews/{interviewId}/follow-ups', { params: { path: { interviewId } } })).items,
  });
}

export function useSuggestFollowUp(interviewId: string) {
  const client = useQueryClient();
  const attempt = useRef<string | null>(null);
  return useMutation({
    mutationFn: async ({ audio, question, sample = false }: { audio?: Blob; question?: string; sample?: boolean }) => {
      const form = new FormData();
      if (audio) form.append('audio', audio, audio.type.includes('ogg') ? 'answer.ogg' : 'answer.webm');
      if (question) form.append('question', question);
      if (sample) form.append('sample', 'true');
      const response = await fetch(`/api/v1/interviews/${encodeURIComponent(interviewId)}/follow-ups`, {
        method: 'POST', headers: { 'Idempotency-Key': (attempt.current ??= crypto.randomUUID()) }, body: form,
      });
      if (!response.ok) throw await readApiError(response);
      return await response.json() as FollowUp;
    },
    onSuccess: (item) => {
      attempt.current = null;
      client.setQueryData<FollowUp[]>(followUpsKey(interviewId), (items) => [item, ...(items ?? []).filter((old) => old.followUpId !== item.followUpId)]);
    },
  });
}

export function useMarkFollowUp(interviewId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ followUpId, suggestionId, status }: { followUpId: string; suggestionId: string; status: 'asked' | 'dismissed' }) =>
      unwrap(await api.PUT('/v1/interviews/{interviewId}/follow-ups/{followUpId}/suggestions/{suggestionId}', {
        params: { path: { interviewId, followUpId, suggestionId } }, body: { status },
      })),
    onSuccess: (item) => client.setQueryData<FollowUp[]>(followUpsKey(interviewId), (items) => items?.map((old) => old.followUpId === item.followUpId ? item : old)),
  });
}
