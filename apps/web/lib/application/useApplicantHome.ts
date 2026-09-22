'use client';

import type { ActiveCycle, ApplicationDraft, TestAttemptSummary } from '@invision/stand-client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/error';

/**
 * Every state the applicant's home screen can be in, as a single value.
 *
 * The specification (section 27) insists these stay distinguishable, and the
 * one that matters most is `no-cycle`: an admissions window that is closed is a
 * normal product state, not a failure, and rendering it as a generic error
 * would tell an applicant their application broke when nothing did.
 */
export type ApplicantHomeState =
  | { kind: 'loading' }
  | { kind: 'apply'; cycle: ActiveCycle }
  | {
      kind: 'continue';
      cycle: ActiveCycle;
      draft: ApplicationDraft;
      /**
       * The forced-choice attempt: the summary when there is one, null when it
       * has not been started, and undefined when the read itself failed. The
       * third case is kept apart from the second on purpose — "not started" is
       * a claim about the applicant, and it should not be made on the strength
       * of a request that did not come back.
       */
      test: TestAttemptSummary | null | undefined;
    }
  | { kind: 'no-cycle' }
  | { kind: 'forbidden' }
  | { kind: 'session-expired' }
  | { kind: 'failed'; message: string };

function codeOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/** Reads the attempt behind a draft, distinguishing "none yet" from "unknown". */
async function readAttempt(applicationId: string): Promise<TestAttemptSummary | null | undefined> {
  try {
    return await api.tests.attempt(applicationId);
  } catch (error) {
    return codeOf(error) === 'TEST_ATTEMPT_NOT_FOUND' ? null : undefined;
  }
}

/**
 * Resolves the state without touching React state, so the effect below can
 * await it and set the result once. Reading and setting are kept apart on
 * purpose: setting state synchronously from an effect is what React 19's lint
 * rule warns about, and the split also makes the state machine testable on its
 * own.
 */
async function resolveState(): Promise<ApplicantHomeState> {
  let cycle: ActiveCycle;

  try {
    cycle = await api.cycles.active();
  } catch (error) {
    const code = codeOf(error);
    if (code === 'NO_ACTIVE_APPLICATION_CYCLE') return { kind: 'no-cycle' };
    if (code === 'FORBIDDEN') return { kind: 'forbidden' };
    if (code === 'UNAUTHORIZED') return { kind: 'session-expired' };
    return { kind: 'failed', message: 'Could not load the admissions data. Please try again.' };
  }

  try {
    const draft = await api.applications.current();
    return { kind: 'continue', cycle, draft, test: await readAttempt(draft.id) };
  } catch (error) {
    const code = codeOf(error);
    // No draft yet is the ordinary starting point, not a failure.
    if (code === 'APPLICATION_NOT_FOUND') return { kind: 'apply', cycle };
    if (code === 'UNAUTHORIZED') return { kind: 'session-expired' };
    if (code === 'FORBIDDEN') return { kind: 'forbidden' };
    return { kind: 'failed', message: 'Could not load your application. Please try again.' };
  }
}

export function useApplicantHome() {
  const [state, setState] = useState<ApplicantHomeState>({ kind: 'loading' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void resolveState().then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setState({ kind: 'loading' });
    setState(await resolveState());
  }, []);

  /** Creates the one draft this applicant may have in the active cycle. */
  const apply = useCallback(
    async (cycleId: string) => {
      setCreating(true);
      try {
        const draft = await api.applications.createDraft(cycleId);
        setState((current) =>
          current.kind === 'apply'
            ? { kind: 'continue', cycle: current.cycle, draft, test: null }
            : current,
        );
        return draft;
      } catch (error) {
        // Someone already created it — in another tab, or a retried request.
        // Reloading is the honest answer, not a second draft.
        if (codeOf(error) === 'APPLICATION_ALREADY_EXISTS') {
          await reload();
          return undefined;
        }
        throw error;
      } finally {
        setCreating(false);
      }
    },
    [reload],
  );

  return { state, creating, reload, apply };
}
