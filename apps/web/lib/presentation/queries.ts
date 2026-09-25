'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { candidatesKey } from '../api/candidates';
import { api, unwrap } from '../api/client';
import { readApiError } from '../api/errors';
import { toPresentation } from '../api/mappers/presentation';
import type { Presentation } from './types';

export const presentationKey = (presentationId: string) => ['presentation', presentationId] as const;

/** Played through our own `/api`, which adds the staff key; every play is an audit line. */
export function presentationVideoUrl(presentationId: string): string {
  return `/api/v1/presentations/${encodeURIComponent(presentationId)}/video`;
}

/** The presentation as this role may see it, polled every 5 seconds while it is transcribed. */
export function usePresentation(presentationId: string | null | undefined) {
  return useQuery({
    queryKey: presentationKey(presentationId ?? ''),
    enabled: Boolean(presentationId),
    queryFn: async () =>
      toPresentation(
        unwrap(await api.GET('/v1/presentations/{presentationId}', { params: { path: { presentationId: presentationId as string } } })),
      ),
    refetchInterval: (query) => (query.state.data?.status === 'transcribing' ? 5_000 : false),
  });
}

export interface PresentationInput {
  candidateId: string;
  video: Blob;
  consentVideo: boolean;
  consentProcessing: boolean;
}

/**
 * Sends the presentation — once. "Try again" after a network failure repeats
 * the same `Idempotency-Key`, so the server never sees a second one.
 */
export function useSubmitPresentation() {
  const client = useQueryClient();
  const key = useRef<string | null>(null);
  return useMutation({
    mutationFn: async ({ candidateId, video, consentVideo, consentProcessing }: PresentationInput): Promise<Presentation> => {
      key.current ??= crypto.randomUUID();
      const form = new FormData();
      form.append('candidateId', candidateId);
      form.append('consentVideo', String(consentVideo));
      form.append('consentProcessing', String(consentProcessing));
      form.append('video', video, video.type.includes('mp4') || video.type.includes('quicktime') ? 'presentation.mp4' : 'presentation.webm');
      const response = await fetch('/api/v1/presentations', { method: 'POST', headers: { 'Idempotency-Key': key.current }, body: form });
      if (!response.ok) throw await readApiError(response);
      return toPresentation(await response.json());
    },
    onSuccess: (presentation) => {
      key.current = null;
      client.setQueryData(presentationKey(presentation.presentationId), presentation);
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}
