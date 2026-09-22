import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './generated/schema';
import { networkError, toApiError } from './errors';

export interface ApiClientOptions {
  /**
   * Where the API lives. In the browser this is the same-origin `/api` boundary
   * (ADR-0006); on the server it is an absolute URL, because there is no origin
   * to be same as.
   */
  baseUrl?: string;
  /**
   * Cookie names to read the CSRF token from, in order. Staging uses the
   * `__Host-` prefixed name fixed by the contract; plain HTTP in local
   * development cannot set a `__Host-` cookie, hence the second name.
   */
  csrfCookieNames?: readonly string[];
  /** Injectable for tests and for server runtimes with their own fetch. */
  fetch?: typeof globalThis.fetch;
}

export const DEFAULT_CSRF_COOKIE_NAMES = ['__Host-invision_csrf', 'invision_csrf'] as const;

function readCookie(names: readonly string[]): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const name of names) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }
  return undefined;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type RawClient = ReturnType<typeof createClient<paths>>;

export function createRawClient(options: ApiClientOptions = {}): RawClient {
  const csrfCookieNames = options.csrfCookieNames ?? DEFAULT_CSRF_COOKIE_NAMES;

  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    credentials: 'include',
    fetch: options.fetch,
  });

  const csrf: Middleware = {
    async onRequest({ request }) {
      if (!MUTATING.has(request.method)) return undefined;
      const token = readCookie(csrfCookieNames);
      if (token) request.headers.set('X-CSRF-Token', token);
      return request;
    },
  };

  client.use(csrf);
  return client;
}

/**
 * Turns openapi-fetch's `{ data, error }` result into a value or a throw.
 *
 * Call sites in this repository already branch on a thrown ApiError, and a
 * throw is harder to ignore by accident than an error field. A 204 carries no
 * body, which is a success with nothing to return.
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };

  try {
    result = await call;
  } catch (cause) {
    throw networkError(cause instanceof Error && cause.message ? cause.message : 'Request failed');
  }

  if (result.error !== undefined) {
    throw toApiError(result.response.status, result.error, result.response.statusText || 'Request failed');
  }

  if (!result.response.ok) {
    throw toApiError(result.response.status, result.data, result.response.statusText || 'Request failed');
  }

  return result.data as T;
}
