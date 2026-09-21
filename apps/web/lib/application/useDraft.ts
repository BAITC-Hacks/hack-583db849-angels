'use client';

import type { ApplicationDraft, DraftAnswerPatch, DraftAnswers } from '@invision/stand-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/error';

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'unsaved' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'conflict' }
  | { kind: 'field-error'; questionId?: string }
  | { kind: 'failed'; message: string };

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; draft: ApplicationDraft }
  | { kind: 'missing' }
  | { kind: 'session-expired' }
  | { kind: 'forbidden' }
  | { kind: 'failed'; message: string };

/** Debounce from the specification: about 800 ms, only changed keys. */
const DEBOUNCE_MS = 800;

function codeOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

async function loadDraft(): Promise<LoadState> {
  try {
    return { kind: 'ready', draft: await api.applications.current() };
  } catch (error) {
    const code = codeOf(error);
    if (code === 'APPLICATION_NOT_FOUND') return { kind: 'missing' };
    if (code === 'UNAUTHORIZED') return { kind: 'session-expired' };
    if (code === 'FORBIDDEN') return { kind: 'forbidden' };
    return { kind: 'failed', message: 'Could not load your application. Please try again.' };
  }
}

/**
 * Holds the draft and saves changed answers on a debounce.
 *
 * Three rules from the specification shape this and are worth naming, because
 * each of them is a way an autosave can quietly lose someone's work:
 *
 * - only changed keys are sent, with the form version and the revision the
 *   client last saw;
 * - the returned revision is adopted, so the next save is not stale by
 *   construction;
 * - a revision conflict never retries. The server copy is reloaded and the
 *   applicant is told, because silently replaying a save is exactly how the
 *   other device's work disappears.
 *
 * Answers live in component state only. Nothing here writes to browser storage.
 */
export function useDraft() {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [answers, setAnswers] = useState<DraftAnswers>({});
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  /**
   * The draft is mirrored in a ref because a save needs its id, bound form
   * version and last revision at the moment it fires — not the values captured
   * when the handler was created. Reading it from a state updater instead would
   * mean doing network work inside one, which React may run twice.
   */
  const draftRef = useRef<ApplicationDraft | null>(null);
  const pending = useRef<DraftAnswerPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const accept = useCallback((next: LoadState) => {
    setLoad(next);
    draftRef.current = next.kind === 'ready' ? next.draft : null;
    if (next.kind === 'ready') setAnswers(next.draft.answers);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadDraft().then((next) => {
      if (!cancelled) accept(next);
    });

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [accept]);

  const reload = useCallback(async () => {
    const next = await loadDraft();
    accept(next);
    if (next.kind === 'ready') {
      pending.current = {};
      setSave({ kind: 'idle' });
    }
  }, [accept]);

  /**
   * Returns whether the draft is saved, which is what the Continue action needs:
   * the specification only lets an applicant leave the form for the test once
   * the pending save has actually landed. Nothing to save counts as saved.
   */
  const flush = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;

    const draft = draftRef.current;
    const patch = pending.current;
    if (!draft || Object.keys(patch).length === 0) return true;

    inFlight.current = true;
    pending.current = {};
    setSave({ kind: 'saving' });

    try {
      const next = await api.applications.saveAnswers(draft.id, {
        formVersionId: draft.formVersion.id,
        expectedRevision: draft.revision,
        answers: patch,
      });

      accept({ kind: 'ready', draft: next });
      setSave({ kind: 'saved', at: Date.now() });
      return true;
    } catch (error) {
      const code = codeOf(error);

      if (code === 'DRAFT_REVISION_CONFLICT' || code === 'FORM_VERSION_MISMATCH' || code === 'UNKNOWN_QUESTION') {
        // Never retry a conflict: re-read the server copy and say so. Replaying
        // the save is exactly how the other device's work disappears.
        await reload();
        setSave({ kind: 'conflict' });
      } else if (code === 'INVALID_ANSWER_TYPE' || code === 'INVALID_ANSWER_VALUE') {
        const details = error instanceof ApiError ? error.details : undefined;
        const questionId = typeof details?.questionId === 'string' ? details.questionId : undefined;
        setSave({ kind: 'field-error', questionId });
      } else if (code === 'UNAUTHORIZED') {
        accept({ kind: 'session-expired' });
      } else if (code === 'CSRF_VALIDATION_FAILED') {
        setSave({ kind: 'failed', message: 'Could not verify the session. Please refresh the page.' });
      } else {
        setSave({ kind: 'failed', message: 'Could not save. We will try again on your next change.' });
      }
      return false;
    } finally {
      inFlight.current = false;
      if (Object.keys(pending.current).length > 0) await flushRef.current();
    }
  }, [accept, reload]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** Records a change locally and schedules the save. */
  const change = useCallback(
    (questionId: string, value: DraftAnswerPatch[string]) => {
      setAnswers((current) => {
        const next = { ...current };
        const removes =
          value === null ||
          (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0);

        if (removes) delete next[questionId];
        else next[questionId] = value as DraftAnswers[string];

        return next;
      });

      pending.current = { ...pending.current, [questionId]: value };
      setSave({ kind: 'unsaved' });

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flushRef.current(), DEBOUNCE_MS);
    },
    [],
  );

  /** Saves immediately — used by the explicit control and on leaving a field. */
  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void flushRef.current();
  }, []);

  /**
   * Saves immediately and reports the outcome, for the caller that has to know
   * before it navigates away.
   */
  const flushPending = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    return flushRef.current();
  }, []);

  return { load, answers, save, change, saveNow, flushPending, reload };
}
