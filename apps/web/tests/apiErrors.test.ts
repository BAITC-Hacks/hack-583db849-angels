import { describe, expect, it } from 'vitest';
import { ApiError, errorText, isRetryable, readApiError } from '../lib/api/errors';

describe('reading an error from the API', () => {
  it('takes the code and the trace id from the body', async () => {
    const response = new Response(
      JSON.stringify({ error: { code: 'DRAFT_LOCKED', message: 'server wording', traceId: 'a1b2c3' } }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    );

    const error = await readApiError(response);
    expect(error.code).toBe('DRAFT_LOCKED');
    expect(error.status).toBe(409);
    expect(error.traceId).toBe('a1b2c3');
  });

  it('still gives a code when the body is empty or not JSON', async () => {
    expect((await readApiError(new Response('', { status: 403 }))).code).toBe('FORBIDDEN');
    expect((await readApiError(new Response('<html>', { status: 503 }))).code).toBe('AI_UNAVAILABLE');
  });
});

describe('what the person reads', () => {
  it('shows our own text, never the server wording', () => {
    const locked = new ApiError(409, 'DRAFT_LOCKED');
    expect(errorText(locked, 'en')).toContain('Save your own scores first');
    expect(errorText(locked, 'ru')).toContain('Сначала сохраните свои баллы');
  });

  it('keeps the trace id for a code it does not know', () => {
    expect(errorText(new ApiError(500, 'WHAT_IS_THIS', 'a1b2c3'), 'en')).toContain('a1b2c3');
    expect(errorText(new ApiError(500, 'WHAT_IS_THIS', 'a1b2c3'), 'ru')).toContain('a1b2c3');
  });

  it('treats anything that is not an API error as a lost connection', () => {
    expect(errorText(new TypeError('failed to fetch'), 'en')).toContain('No connection');
  });
});

describe('what may be retried', () => {
  it('retries a lost connection and a 5xx, never a 4xx', () => {
    expect(isRetryable(new TypeError('failed to fetch'))).toBe(true);
    expect(isRetryable(new ApiError(503, 'AI_UNAVAILABLE'))).toBe(true);
    expect(isRetryable(new ApiError(409, 'TURN_IN_FLIGHT'))).toBe(false);
    expect(isRetryable(new ApiError(403, 'FORBIDDEN'))).toBe(false);
  });
});
