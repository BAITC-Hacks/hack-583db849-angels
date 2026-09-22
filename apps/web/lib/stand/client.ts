import { createApi } from '@invision/stand-client';
import { getApiUrl } from './config';

/**
 * The application's single API client.
 *
 * Every call to an application endpoint goes through here:
 * docs/contract-governance.md forbids direct fetch calls and handwritten copies
 * of wire types, because neither can be checked against the contract.
 *
 * In the browser the base URL is the same-origin `/api` boundary. On the server
 * there is no origin to be same as, so a caller passes an absolute URL through
 * createServerApi instead.
 */
export const api = createApi({ baseUrl: getApiUrl() });

/**
 * Server-side client for an absolute base URL — used by route handlers and
 * server components, which cannot rely on a relative path.
 */
export function createServerApi(baseUrl: string) {
  return createApi({ baseUrl });
}
