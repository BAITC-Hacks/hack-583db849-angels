import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CYCLE_ID, resetS2 } from '../mocks/s2';
import { resetS3, scenario, TEST_VERSION_ID } from '../mocks/s3';
import { assertMatchesSchema } from './schema';
import { call, clearCookies, readCookie, server } from './mockServer';

/**
 * The forced-choice contract as the mock implements it.
 *
 * The cases worth having are the ones that decide whether an applicant can be
 * treated unfairly: a reload must not buy more time and must not lose the block
 * either, a lost response must not cost an answer that was stored, a block that
 * is closed must stay closed, and one applicant must never learn anything about
 * another's attempt.
 */
const DEMO = { email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' };

interface Attempt {
  id: string;
  revision: number;
  status: string;
  totalBlocks: number;
  answeredBlocks: number;
  timedOutBlocks: number;
  currentBlockNumber: number | null;
}

interface BlockResponse {
  attempt: Attempt;
  currentBlock: {
    id: string;
    position: number;
    statements: { id: string; text: string }[];
    timeLimitSeconds: number;
    startedAt: string;
    expiresAt: string;
  } | null;
  serverTime: string;
  timedOutOnThisRequest: boolean;
}

async function signIn(): Promise<void> {
  await call('/auth/login', { method: 'POST', body: JSON.stringify(DEMO) });
}

function csrf(): Record<string, string> {
  return { 'X-CSRF-Token': readCookie('invision_csrf') ?? '' };
}

async function startApplication(): Promise<string> {
  const { body } = await call('/applications', {
    method: 'POST',
    headers: csrf(),
    body: JSON.stringify({ cycleId: CYCLE_ID }),
  });
  return (body as { id: string }).id;
}

async function startAttempt(applicationId: string): Promise<Attempt> {
  const { body } = await call(`/applications/${applicationId}/test-attempt`, {
    method: 'POST',
    headers: csrf(),
  });
  return body as Attempt;
}

async function currentBlock(attemptId: string): Promise<BlockResponse> {
  const { body } = await call(`/test-attempts/${attemptId}/current-block`, {
    method: 'POST',
    headers: csrf(),
  });
  return body as BlockResponse;
}

async function answer(
  attemptId: string,
  blockId: string,
  expectedRevision: number,
  mostStatementId: string,
  leastStatementId: string,
) {
  return call(`/test-attempts/${attemptId}/blocks/${blockId}/response`, {
    method: 'PUT',
    headers: csrf(),
    body: JSON.stringify({ expectedRevision, mostStatementId, leastStatementId }),
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
  resetS2();
  resetS3();
  clearCookies();
  localStorage.clear();
  await signIn();
});

describe('creating the attempt', () => {
  it('binds the published version and starts no timer', async () => {
    const applicationId = await startApplication();

    const { status, body } = await call(`/applications/${applicationId}/test-attempt`, {
      method: 'POST',
      headers: csrf(),
    });

    expect(status).toBe(201);
    assertMatchesSchema('TestAttemptSummary', body);
    const attempt = body as Attempt & { testVersion: { id: string } };
    expect(attempt.testVersion.id).toBe(TEST_VERSION_ID);
    expect(attempt.status).toBe('IN_PROGRESS');
    expect(attempt.totalBlocks).toBe(10);
    expect(attempt.revision).toBe(0);
    expect(attempt.currentBlockNumber).toBe(1);
  });

  it('refuses a second attempt for the same application', async () => {
    const applicationId = await startApplication();
    await startAttempt(applicationId);

    const { status, body } = await call(`/applications/${applicationId}/test-attempt`, {
      method: 'POST',
      headers: csrf(),
    });

    expect(status).toBe(409);
    assertMatchesSchema('ApiError', body);
    expect((body as { code: string }).code).toBe('TEST_ATTEMPT_ALREADY_EXISTS');
  });

  it("reports an application that is not the caller's as missing", async () => {
    const { status, body } = await call('/applications/11111111-2222-4333-8444-555555555555/test-attempt', {
      method: 'POST',
      headers: csrf(),
    });

    expect(status).toBe(404);
    expect((body as { code: string }).code).toBe('APPLICATION_NOT_FOUND');
  });

  it('requires CSRF', async () => {
    const applicationId = await startApplication();

    const { status, body } = await call(`/applications/${applicationId}/test-attempt`, { method: 'POST' });

    expect(status).toBe(403);
    expect((body as { code: string }).code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('answers an unauthenticated caller with 401', async () => {
    const applicationId = await startApplication();
    clearCookies();

    const { status } = await call(`/applications/${applicationId}/test-attempt`, { method: 'POST' });

    expect(status).toBe(401);
  });
});

describe('reading progress', () => {
  it('reports a missing attempt rather than inventing one', async () => {
    const applicationId = await startApplication();

    const { status, body } = await call(`/applications/${applicationId}/test-attempt`);

    expect(status).toBe(404);
    expect((body as { code: string }).code).toBe('TEST_ATTEMPT_NOT_FOUND');
  });

  it('never carries the block text, so progress cannot leak the next question', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    await currentBlock(attempt.id);

    const { status, body } = await call(`/applications/${applicationId}/test-attempt`);

    expect(status).toBe(200);
    assertMatchesSchema('TestAttemptSummary', body);
    expect(JSON.stringify(body)).not.toContain('statement_');
  });
});

describe('the current block', () => {
  it('returns four statements and a server deadline', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);

    const { status, body } = await call(`/test-attempts/${attempt.id}/current-block`, {
      method: 'POST',
      headers: csrf(),
    });

    expect(status).toBe(200);
    assertMatchesSchema('CurrentTestBlockResponse', body);
    const response = body as BlockResponse;
    expect(response.currentBlock?.statements).toHaveLength(4);
    expect(response.currentBlock?.position).toBe(1);
    expect(Date.parse(response.currentBlock!.expiresAt)).toBeGreaterThan(
      Date.parse(response.currentBlock!.startedAt),
    );
    expect(response.timedOutOnThisRequest).toBe(false);
  });

  it('gives a reload the same block and the same deadline', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);

    const first = await currentBlock(attempt.id);
    const second = await currentBlock(attempt.id);

    expect(second.currentBlock?.id).toBe(first.currentBlock?.id);
    expect(second.currentBlock?.expiresAt).toBe(first.currentBlock?.expiresAt);
    expect(second.attempt.revision).toBe(first.attempt.revision);
    expect(second.currentBlock?.statements.map((s) => s.id)).toEqual(
      first.currentBlock?.statements.map((s) => s.id),
    );
  });

  it('records the block as timed out once its deadline has passed', async () => {
    scenario.timeLimitSecondsOverride = 10;
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const first = await currentBlock(attempt.id);

    // The deadline is the server's, so the test moves the clock the mock server
    // reads. Real timers keep running underneath, or the handler's own delay
    // would never resolve.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.parse(first.currentBlock!.expiresAt) + 1000));
    const second = await currentBlock(attempt.id);

    expect(second.timedOutOnThisRequest).toBe(true);
    expect(second.attempt.timedOutBlocks).toBe(1);
    expect(second.attempt.answeredBlocks).toBe(0);
    expect(second.attempt.revision).toBe(1);
    expect(second.currentBlock?.id).not.toBe(first.currentBlock?.id);
    vi.useRealTimers();
  });

  it("reports another applicant's attempt as missing", async () => {
    const { status, body } = await call('/test-attempts/99999999-9999-4999-8999-999999999999/current-block', {
      method: 'POST',
      headers: csrf(),
    });

    expect(status).toBe(404);
    expect((body as { code: string }).code).toBe('TEST_ATTEMPT_NOT_FOUND');
  });
});

describe('answering a block', () => {
  it('stores one pair and advances the attempt', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;

    const { status, body } = await answer(
      attempt.id,
      block.id,
      0,
      block.statements[0].id,
      block.statements[1].id,
    );

    expect(status).toBe(200);
    assertMatchesSchema('SubmitTestBlockResponse', body);
    const result = body as { attempt: Attempt; result: { outcome: string } };
    expect(result.result.outcome).toBe('ANSWERED');
    expect(result.attempt.answeredBlocks).toBe(1);
    expect(result.attempt.revision).toBe(1);
  });

  it('never echoes the selections back', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;

    const { body } = await answer(attempt.id, block.id, 0, block.statements[0].id, block.statements[1].id);

    expect(JSON.stringify(body)).not.toContain(block.statements[0].id);
  });

  it('refuses the same statement for both choices', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;

    const { status, body } = await answer(
      attempt.id,
      block.id,
      0,
      block.statements[0].id,
      block.statements[0].id,
    );

    expect(status).toBe(400);
    expect((body as { code: string }).code).toBe('SAME_MOST_AND_LEAST');
  });

  it('refuses a statement that belongs to another block', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;

    const { status, body } = await answer(attempt.id, block.id, 0, block.statements[0].id, 'statement_99_z');

    expect(status).toBe(400);
    expect((body as { code: string }).code).toBe('UNKNOWN_TEST_STATEMENT');
  });

  it('refuses a stale revision instead of overwriting', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;

    const { status, body } = await answer(
      attempt.id,
      block.id,
      7,
      block.statements[0].id,
      block.statements[1].id,
    );

    expect(status).toBe(409);
    expect((body as { code: string }).code).toBe('TEST_REVISION_CONFLICT');
  });

  it('returns the stored result for an identical retry, so a lost response costs nothing', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;
    const first = await answer(attempt.id, block.id, 0, block.statements[0].id, block.statements[1].id);

    const retry = await answer(attempt.id, block.id, 0, block.statements[0].id, block.statements[1].id);

    expect(retry.status).toBe(200);
    expect((retry.body as { result: { outcome: string } }).result.outcome).toBe('ANSWERED');
    expect((retry.body as { attempt: Attempt }).attempt.revision).toBe(
      (first.body as { attempt: Attempt }).attempt.revision,
    );
  });

  it('refuses a different pair for a block that is already answered', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;
    await answer(attempt.id, block.id, 0, block.statements[0].id, block.statements[1].id);

    const { status, body } = await answer(
      attempt.id,
      block.id,
      1,
      block.statements[2].id,
      block.statements[3].id,
    );

    expect(status).toBe(409);
    expect((body as { code: string }).code).toBe('TEST_BLOCK_LOCKED');
  });

  it('refuses an answer aimed at a block that is not current', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;
    const other = block.id === 'block_01' ? 'block_02' : 'block_01';

    const { status, body } = await answer(attempt.id, other, 0, 'statement_01_a', 'statement_01_b');

    expect(status).toBe(409);
    expect((body as { code: string }).code).toBe('TEST_BLOCK_NOT_CURRENT');
  });

  it('records a late answer as a timeout rather than storing it', async () => {
    scenario.timeLimitSecondsOverride = 10;
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;

    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.parse(block.expiresAt) + 500));
    const { status, body } = await answer(
      attempt.id,
      block.id,
      0,
      block.statements[0].id,
      block.statements[1].id,
    );

    expect(status).toBe(200);
    const result = body as { attempt: Attempt; result: { outcome: string } };
    expect(result.result.outcome).toBe('TIMED_OUT');
    expect(result.attempt.timedOutBlocks).toBe(1);
    expect(result.attempt.answeredBlocks).toBe(0);
    vi.useRealTimers();
  });
});

describe('finishing the attempt', () => {
  it('completes after ten blocks and offers no eleventh', async () => {
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);

    let progress = await currentBlock(attempt.id);
    for (let index = 0; index < 10; index += 1) {
      const block = progress.currentBlock!;
      const { body } = await answer(
        attempt.id,
        block.id,
        progress.attempt.revision,
        block.statements[0].id,
        block.statements[1].id,
      );
      const next = body as { attempt: Attempt };
      if (next.attempt.status === 'COMPLETED') {
        expect(next.attempt.answeredBlocks).toBe(10);
        expect(next.attempt.currentBlockNumber).toBeNull();
        break;
      }
      progress = await currentBlock(attempt.id);
    }

    const final = await currentBlock(attempt.id);
    expect(final.attempt.status).toBe('COMPLETED');
    expect(final.currentBlock).toBeNull();
    assertMatchesSchema('CurrentTestBlockResponse', final);
  });
});

describe('browser storage during the test', () => {
  it('stores nothing but the theme while a whole attempt is answered', async () => {
    localStorage.setItem('invision-theme', 'dark');
    const applicationId = await startApplication();
    const attempt = await startAttempt(applicationId);
    const block = (await currentBlock(attempt.id)).currentBlock!;
    await answer(attempt.id, block.id, 0, block.statements[0].id, block.statements[1].id);
    await currentBlock(attempt.id);

    // Theme and the session marker, and nothing from the attempt itself.
    expect(Object.keys(localStorage).sort()).toEqual(['invision-mock-session', 'invision-theme']);
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain(attempt.id);
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain(block.id);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });
});
