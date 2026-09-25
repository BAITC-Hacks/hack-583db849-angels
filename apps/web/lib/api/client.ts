import { createApiClient } from '@invision/api-client';
import { ApiError, toApiError } from './errors';

/**
 * The one way a screen reaches the API. The base URL is this app's own `/api`
 * (the contract's paths start with `/v1`), so the browser sends no key and
 * needs no CORS: the route handler adds the key of the demo role in the cookie.
 *
 * `fetch` is looked up on each call rather than kept from when this module
 * loaded, and the origin is spelled out, so the same client runs in tests.
 */
export const api = createApiClient({
  baseUrl: typeof window === 'undefined' ? '/api' : `${window.location.origin}/api`,
  fetch: (input) => globalThis.fetch(input),
});

interface Result<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Turns an `openapi-fetch` result into either the data or an `ApiError` the
 * screen can put into a sentence. A query that throws is what TanStack Query
 * needs to decide whether to retry.
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.response.ok && result.data !== undefined) return result.data;
  throw toApiError(result.response.status, result.error ?? null);
}

export { ApiError };
