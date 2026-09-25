'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { candidatesKey } from '../api/candidates';
import { api, ApiError, unwrap } from '../api/client';
import { readApiError } from '../api/errors';
import { toAssessmentDraft, toInterviewRecord } from '../api/mappers/interview';
import type { Competency } from '../drive';
import type { Score } from '../../components/evidence/ScoreMeter';
import type { InterviewRecord } from './types';

export const interviewKey = (interviewId: string) => ['interview', interviewId] as const;
export const draftKey = (interviewId: string) => ['interview-draft', interviewId] as const;

/**
 * The demo has one interviewer. This is their pseudonym — never a name — and
 * it is the same one the synthetic panel history uses, so the quality guard's
 * calibration reads today's scores beside the month's.
 */
export const DEMO_INTERVIEWER_REF = 'synthetic-interviewer-a';

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

/** The interview, polled every 3 seconds while its recording is being transcribed. */
export function useInterviewRecord(interviewId: string) {
  return useQuery({
    queryKey: interviewKey(interviewId),
    queryFn: async () =>
      toInterviewRecord(unwrap(await api.GET('/v1/interviews/{interviewId}', { params: { path: { interviewId } } }))),
    refetchInterval: (query) => (query.state.data?.transcriptStatus === 'transcribing' ? 3_000 : false),
  });
}

/**
 * The draft — asked for only once the interviewer's scores are saved, so
 * before that it is not in the page and not in the network. The API writes
 * it by itself once the transcript is there too; until then it answers
 * `404 DRAFT_NOT_FOUND`, and this asks again every 3 seconds.
 */
export function useInterviewDraft(interviewId: string, { scoresSaved, transcriptReady }: { scoresSaved: boolean; transcriptReady: boolean }) {
  return useQuery({
    queryKey: draftKey(interviewId),
    enabled: scoresSaved,
    queryFn: async () =>
      toAssessmentDraft(
        unwrap(await api.GET('/v1/interviews/{interviewId}/assessment-draft', { params: { path: { interviewId } } })),
      ),
    retry: false,
    refetchInterval: (query) => {
      const missing = query.state.error instanceof ApiError && query.state.error.code === 'DRAFT_NOT_FOUND';
      return transcriptReady && !query.state.data && (missing || query.state.status === 'pending') ? 3_000 : false;
    },
  });
}

export interface NewInterview {
  candidateId: string;
}

/** A new interview, held now, by the demo's interviewer. */
export function useCreateInterview() {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async ({ candidateId }: NewInterview) =>
      toInterviewRecord(
        unwrap(
          await api.POST('/v1/interviews', {
            body: { candidateId, heldAt: new Date().toISOString(), interviewerRef: DEMO_INTERVIEWER_REF },
            headers: { 'Idempotency-Key': attempt.get() },
          }),
        ),
      ),
    onSuccess: (record) => {
      attempt.done();
      client.setQueryData(interviewKey(record.view.interviewId), record);
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}

/** The recording, with the candidate's consent, as multipart. The server answers at once with `transcribing`. */
export function useUploadRecording(interviewId: string) {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async ({ audio, consent }: { audio: Blob; consent: boolean }): Promise<InterviewRecord> => {
      const form = new FormData();
      form.append('audio', audio, audio.type.includes('wav') ? 'interview.wav' : audio.type.includes('ogg') ? 'interview.ogg' : 'interview.webm');
      form.append('consent', String(consent));
      const response = await fetch(`/api/v1/interviews/${encodeURIComponent(interviewId)}/recording`, {
        method: 'POST',
        headers: { 'Idempotency-Key': attempt.get() },
        body: form,
      });
      if (!response.ok) throw await readApiError(response);
      return toInterviewRecord(await response.json());
    },
    onSuccess: (record) => {
      attempt.done();
      client.setQueryData(interviewKey(interviewId), record);
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}

/** The interviewer's own scores. Once the server has them they are fixed, and only then is the draft asked for. */
export function useSaveScores(interviewId: string) {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async (scores: Record<Competency, Score>) =>
      unwrap(
        await api.POST('/v1/interviews/{interviewId}/interviewer-scores', {
          params: { path: { interviewId } },
          body: { scores },
          headers: { 'Idempotency-Key': attempt.get() },
        }),
      ),
    onSuccess: (saved) => {
      attempt.done();
      client.setQueryData<InterviewRecord>(interviewKey(interviewId), (record) =>
        record ? { ...record, savedScores: saved.scores as Record<Competency, Score> } : record,
      );
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });
}

/** A new draft now, for when the automatic one did not come. */
export function useRedoDraft(interviewId: string) {
  const client = useQueryClient();
  const attempt = useAttemptKey();
  return useMutation({
    mutationFn: async () =>
      toAssessmentDraft(
        unwrap(
          await api.POST('/v1/interviews/{interviewId}/assessment-draft', {
            params: { path: { interviewId } },
            headers: { 'Idempotency-Key': attempt.get() },
          }),
        ),
      ),
    onSuccess: (draft) => {
      attempt.done();
      client.setQueryData(draftKey(interviewId), draft);
    },
  });
}
