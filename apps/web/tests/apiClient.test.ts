import { createApiClient } from '@invision/api-client';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, unwrap } from '../lib/api/client';

/**
 * The client is generated from `apps/api/openapi.json`, so these calls stop
 * compiling the moment the API drops or renames something the screens use.
 * That is the drift check: it fails on the pull request that changed the API.
 */
function clientAnswering(answer: Response) {
  const fetch = vi.fn(async () => answer) as unknown as typeof globalThis.fetch;
  return { fetch, client: createApiClient({ baseUrl: 'http://web/api/v1', fetch }) };
}

describe('the generated client', () => {
  it('calls the path the contract names and returns the body', async () => {
    const { fetch, client } = clientAnswering(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const result = await client.GET('/v1/health');
    expect(unwrap(result)).toEqual({ status: 'ok' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBeDefined();
  });

  it('turns an error answer into an ApiError with its code', async () => {
    const { client } = clientAnswering(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'no key', traceId: 'a1b2' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await client.GET('/v1/candidates');
    expect(() => unwrap(result)).toThrowError(ApiError);
    try {
      unwrap(result);
    } catch (error) {
      expect((error as ApiError).code).toBe('UNAUTHORIZED');
      expect((error as ApiError).traceId).toBe('a1b2');
    }
  });
});
