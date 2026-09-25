import createClient, { type Client } from 'openapi-fetch';
import type { paths } from './generated/schema';

/**
 * The typed client for our own API, generated from `apps/api/openapi.json`.
 *
 * Nothing here knows about keys: in the browser the base URL is `/api` on the
 * web server itself — the contract's paths already start with `/v1` — and that server adds the key of the demo role
 * (`apps/web/app/api/v1/[...path]`). On the server the caller passes an
 * absolute URL, because there is no origin to be same as.
 */
export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export function createApiClient({ baseUrl = '/api', fetch }: ApiClientOptions = {}): Client<paths> {
  return createClient<paths>({ baseUrl, fetch });
}
