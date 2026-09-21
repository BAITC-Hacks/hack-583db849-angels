'use client';

import type { CurrentTestBlock, CurrentTestBlockResponse, TestAttemptSummary } from '@invision/stand-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/error';

/**
 * Every state the forced-choice screen can be in, as one value.
 *
 * The distinctions that matter are the ones the specification (section 27)
 * refuses to collapse: an attempt that has not started is not an error, a block
 * that ran out of time is not a failed request, and a lost connection is not a
 * lost attempt. Each of those reads differently to the applicant, so each is
 * its own state here rather than a generic failure.
 */
export type TestAttemptState =
  | { kind: 'loading' }
  | { kind: 'no-application' }
  | { kind: 'intro' }
  | { kind: 'block'; attempt: TestAttemptSummary; block: CurrentTestBlock }
  | { kind: 'complete'; attempt: TestAttemptSummary }
  | { kind: 'session-expired' }
  | { kind: 'forbidden' }
  | { kind: 'failed'; message: string };

/** What happened to the block that was just left behind, if anything. */
export type TestNotice = 'timed-out' | 'conflict' | 'locked' | null;

/** A state to show, plus what the same response said about time and timeouts. */
interface Resolved {
  state: TestAttemptState;
  offsetMs?: number;
  timedOut?: boolean;
}

function codeOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/**
 * How far the server's clock is ahead of this device's, measured from the
 * `serverTime` of a response. Every deadline on screen is rendered against it,
 * so a device whose clock is wrong — or moved on purpose — still sees the time
 * the server is actually counting.
 */
function describeBlock(response: CurrentTestBlockResponse): Resolved {
  return {
    state: response.currentBlock
      ? { kind: 'block', attempt: response.attempt, block: response.currentBlock }
      : { kind: 'complete', attempt: response.attempt },
    offsetMs: Date.parse(response.serverTime) - Date.now(),
    timedOut: response.timedOutOnThisRequest,
  };
}

function failureFor(error: unknown, message: string): TestAttemptState {
  const code = codeOf(error);
  if (code === 'UNAUTHORIZED') return { kind: 'session-expired' };
  if (code === 'FORBIDDEN' || code === 'CSRF_VALIDATION_FAILED') return { kind: 'forbidden' };
  return { kind: 'failed', message };
}

export function useTestAttempt() {
  const [state, setState] = useState<TestAttemptState>({ kind: 'loading' });
  const [notice, setNotice] = useState<TestNotice>(null);
  const [busy, setBusy] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);

  /**
   * How far the server's clock is ahead of this device's, measured from the
   * `serverTime` of the last response. Every deadline on screen is rendered
   * against it, so a device whose clock is wrong — or deliberately moved —
   * still sees the time the server is actually counting.
   */
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const applicationId = useRef<string | null>(null);

  /**
   * Reading the server's answer and applying it to the screen are kept apart on
   * purpose. Everything below that talks to the API returns a description of
   * what it found and touches no state; only the callbacks that receive one put
   * it on screen. That is what lets the mount effect call `resolve` without
   * setting state inside the effect itself.
   */
  const applyResolved = useCallback((resolved: Resolved) => {
    setState(resolved.state);
    if (resolved.offsetMs !== undefined) setServerOffsetMs(resolved.offsetMs);
    if (resolved.timedOut) setNotice('timed-out');
    if (resolved.state.kind !== 'failed') setConnectionLost(false);
  }, []);

  /**
   * Reads where the applicant actually is, from the server, every time.
   *
   * Resuming goes through the same call that starts a block, which is what
   * makes a reload safe: the server returns the deadline it already set instead
   * of granting a fresh one.
   */
  const resolve = useCallback(async (): Promise<Resolved> => {
    let application;
    try {
      application = await api.applications.current();
      applicationId.current = application.id;
    } catch (error) {
      if (codeOf(error) === 'APPLICATION_NOT_FOUND') return { state: { kind: 'no-application' } };
      return { state: failureFor(error, 'The application could not be loaded. Try again.') };
    }

    let attempt: TestAttemptSummary;
    try {
      attempt = await api.tests.attempt(application.id);
    } catch (error) {
      // Not started yet is the ordinary beginning, not a failure.
      if (codeOf(error) === 'TEST_ATTEMPT_NOT_FOUND') return { state: { kind: 'intro' } };
      return { state: failureFor(error, 'The state of the test could not be loaded. Try again.') };
    }

    if (attempt.status === 'COMPLETED') return { state: { kind: 'complete', attempt } };

    try {
      return describeBlock(await api.tests.currentBlock(attempt.id));
    } catch (error) {
      return { state: failureFor(error, 'The block could not be loaded. Try again.') };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void resolve().then((resolved) => {
      if (!cancelled) applyResolved(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResolved, resolve]);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      applyResolved(await resolve());
    } finally {
      setBusy(false);
    }
  }, [applyResolved, resolve]);

  /** Creates the single attempt this application may ever have, then opens its first block. */
  const start = useCallback(async () => {
    if (!applicationId.current) return;
    setBusy(true);
    setNotice(null);
    try {
      let attempt: TestAttemptSummary;
      try {
        attempt = await api.tests.createAttempt(applicationId.current);
      } catch (error) {
        // Another tab, or a retried request, got there first. Continuing with
        // the attempt that exists is the honest answer; a second one is not
        // available to anybody, by contract.
        if (codeOf(error) !== 'TEST_ATTEMPT_ALREADY_EXISTS') throw error;
        attempt = await api.tests.attempt(applicationId.current);
      }

      applyResolved(describeBlock(await api.tests.currentBlock(attempt.id)));
    } catch (error) {
      setState(failureFor(error, 'The test could not be started. Try again.'));
    } finally {
      setBusy(false);
    }
  }, [applyResolved]);

  /**
   * Asks the server to move on. Used both when the applicant has answered and
   * when the countdown has run out: in the second case the server is the one
   * that decides the block timed out, because only its clock counts.
   */
  const advance = useCallback(async () => {
    if (state.kind !== 'block') return;
    setBusy(true);
    try {
      applyResolved(describeBlock(await api.tests.currentBlock(state.attempt.id)));
    } catch (error) {
      if (codeOf(error) === 'NETWORK_ERROR') {
        // The block and its deadline stay on screen. Nothing is lost by
        // waiting: the deadline belongs to the server either way.
        setConnectionLost(true);
      } else {
        setState(failureFor(error, 'The block could not be loaded. Try again.'));
      }
    } finally {
      setBusy(false);
    }
  }, [applyResolved, state]);

  const submit = useCallback(
    async (mostStatementId: string, leastStatementId: string) => {
      if (state.kind !== 'block') return;
      setBusy(true);
      setNotice(null);

      try {
        const response = await api.tests.submitBlock(state.attempt.id, state.block.id, {
          expectedRevision: state.attempt.revision,
          mostStatementId,
          leastStatementId,
        });
        setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
        if (response.result.outcome === 'TIMED_OUT') setNotice('timed-out');

        if (response.attempt.status === 'COMPLETED') {
          setState({ kind: 'complete', attempt: response.attempt });
          return;
        }

        // The next deadline starts only when the client asks for the next
        // block, so the applicant never loses seconds to a round trip they did
        // not make.
        applyResolved(describeBlock(await api.tests.currentBlock(response.attempt.id)));
      } catch (error) {
        const code = codeOf(error);

        if (code === 'NETWORK_ERROR') {
          setConnectionLost(true);
          return;
        }

        // The three ways an attempt can have moved on without this screen
        // knowing. None of them is recoverable by retrying the same request, so
        // each one re-reads the truth from the server and says what happened.
        if (code === 'TEST_REVISION_CONFLICT' || code === 'TEST_BLOCK_NOT_CURRENT') {
          applyResolved(await resolve());
          setNotice('conflict');
          return;
        }
        if (code === 'TEST_BLOCK_LOCKED') {
          applyResolved(await resolve());
          setNotice('locked');
          return;
        }

        setState(failureFor(error, 'The choice could not be saved. Try again.'));
      } finally {
        setBusy(false);
      }
    },
    [applyResolved, resolve, state],
  );

  return {
    state,
    notice,
    busy,
    connectionLost,
    serverOffsetMs,
    dismissNotice: useCallback(() => setNotice(null), []),
    start,
    submit,
    advance,
    reload,
  };
}
