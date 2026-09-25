'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { candidatesKey } from '../api/candidates';
import { api, unwrap } from '../api/client';
import { interviewKey } from '../interview/queries';
import { toInterviewRecord } from '../api/mappers/interview';
import type { CallAccess, InterviewSlot } from './types';

export const slotsKey = ['slots'] as const;
export const slotKey = (slotId: string) => ['slots', 'one', slotId] as const;

/** One `Idempotency-Key` per attempt: "Try again" repeats it, a success clears it. */
function useAttemptKey() {
  const key = useRef<string | null>(null);
  return {
    get: () => (key.current ??= crypto.randomUUID()),
    done: () => {
      key.current = null;
    },
  };
}

/**
 * Slots as this role may see them. The candidate's channel asks for the open
 * ones and its own; staff get the last week and everything ahead. Polled
 * every 10 seconds, because a slot is missed by the clock, not by a request.
 */
export function useSlots(query: { open?: boolean; candidateId?: string } = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...slotsKey, query],
    enabled,
    queryFn: async () => unwrap(await api.GET('/v1/interview-slots', { params: { query } })).items as InterviewSlot[],
    refetchInterval: 10_000,
  });
}

/** One slot, every 5 seconds: the call screens watch it for the other side coming, or the wait running out. */
export function useSlot(slotId: string) {
  return useQuery({
    queryKey: slotKey(slotId),
    queryFn: async () => unwrap(await api.GET('/v1/interview-slots/{slotId}', { params: { path: { slotId } } })) as InterviewSlot,
    refetchInterval: 5_000,
  });
}

export function useCreateSlot() {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async (body: { startsAt: string; interviewerRef: string; durationMin: number }) =>
      unwrap(await api.POST('/v1/interview-slots', { body, headers: { 'Idempotency-Key': attempt.get() } })) as InterviewSlot,
    onSuccess: () => {
      attempt.done();
      void client.invalidateQueries({ queryKey: slotsKey });
    },
  });
}

export function useRemoveSlot() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (slotId: string) => {
      unwrap(await api.DELETE('/v1/interview-slots/{slotId}', { params: { path: { slotId } } }));
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: slotsKey }),
  });
}

export function useBookSlot() {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async ({ slotId, candidateId }: { slotId: string; candidateId: string }) =>
      unwrap(
        await api.POST('/v1/interview-slots/{slotId}/booking', {
          params: { path: { slotId } },
          body: { candidateId },
          headers: { 'Idempotency-Key': attempt.get() },
        }),
      ) as InterviewSlot,
    onSuccess: () => {
      attempt.done();
      void client.invalidateQueries({ queryKey: slotsKey });
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}

/** A room token for this role's side of the call. Every join is asked for afresh: a token is not kept. */
export function useJoinCall(slotId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { consentRecording?: boolean }) =>
      unwrap(await api.POST('/v1/interview-slots/{slotId}/join', { params: { path: { slotId } }, body })) as CallAccess,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: slotKey(slotId) });
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}

/** The notes as they stand; they replace what the server had, until the scores are saved. */
export function useSaveNotes(interviewId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (notes: string[]) =>
      toInterviewRecord(unwrap(await api.PUT('/v1/interviews/{interviewId}/notes', { params: { path: { interviewId } }, body: { notes } }))),
    onSuccess: (record) => client.setQueryData(interviewKey(interviewId), record),
  });
}
