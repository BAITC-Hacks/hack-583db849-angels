'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { candidatesKey } from '../api/candidates';
import { api, unwrap } from '../api/client';
import { readApiError } from '../api/errors';
import { toSurpriseQuestion } from '../api/mappers/surprise';
import type { SurpriseQuestion } from './types';

export const surpriseKey = (surpriseId: string) => ['surprise', surpriseId] as const;

/** Played through our own `/api`, which adds the staff key; every play is an audit line on the server. */
export function surpriseVideoUrl(surpriseId: string): string {
  return `/api/v1/surprise-questions/${encodeURIComponent(surpriseId)}/video`;
}

/** The question as this role may see it. Staff screens poll while the answer is being transcribed. */
export function useSurprise(surpriseId: string | null | undefined, { poll = false }: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: surpriseKey(surpriseId ?? ''),
    enabled: Boolean(surpriseId),
    queryFn: async () => {
      const result = await api.GET('/v1/surprise-questions/{surpriseId}', { params: { path: { surpriseId: surpriseId as string } } });
      return toSurpriseQuestion(unwrap(result));
    },
    refetchInterval: (query) => (poll && query.state.data?.status === 'transcribing' ? 5_000 : false),
  });
}

/**
 * One `Idempotency-Key` per attempt: "Try again" after a network failure
 * sends the same key, so the server does not see a second attempt; a new
 * key is made only after a success.
 */
function useAttemptKey() {
  const key = useRef<string | null>(null);
  return {
    get: () => (key.current ??= crypto.randomUUID()),
    done: () => {
      key.current = null;
    },
  };
}

export function useCreateSurprise() {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async (candidateId: string) =>
      toSurpriseQuestion(
        unwrap(await api.POST('/v1/surprise-questions', { body: { candidateId }, headers: { 'Idempotency-Key': attempt.get() } })),
      ),
    onSuccess: (surprise) => {
      attempt.done();
      client.setQueryData(surpriseKey(surprise.surpriseId), surprise);
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}

/** Opens the question: the one attempt, with the server's deadline. */
export function useStartSurprise(surpriseId: string) {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async () =>
      toSurpriseQuestion(
        unwrap(
          await api.POST('/v1/surprise-questions/{surpriseId}/start', {
            params: { path: { surpriseId } },
            headers: { 'Idempotency-Key': attempt.get() },
          }),
        ),
      ),
    onSuccess: (surprise) => {
      attempt.done();
      client.setQueryData(surpriseKey(surpriseId), surprise);
    },
  });
}

export interface SurpriseAnswerInput {
  clip: Blob;
  consentVideo: boolean;
  consentProcessing: boolean;
}

/** The answer: the video and the two consents the candidate ticked, as multipart. The server checks both. */
export function useAnswerSurprise(surpriseId: string) {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async ({ clip, consentVideo, consentProcessing }: SurpriseAnswerInput): Promise<SurpriseQuestion> => {
      const form = new FormData();
      form.append('video', clip, clip.type.includes('mp4') ? 'answer.mp4' : 'answer.webm');
      form.append('consentVideo', String(consentVideo));
      form.append('consentProcessing', String(consentProcessing));
      const response = await fetch(`/api/v1/surprise-questions/${encodeURIComponent(surpriseId)}/answer`, {
        method: 'POST',
        headers: { 'Idempotency-Key': attempt.get() },
        body: form,
      });
      if (!response.ok) throw await readApiError(response);
      return toSurpriseQuestion(await response.json());
    },
    onSuccess: (surprise) => {
      attempt.done();
      client.setQueryData(surpriseKey(surpriseId), surprise);
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}
