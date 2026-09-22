export type ApiMode = 'mock' | 'real';

export function getApiMode(): ApiMode {
  return process.env.NEXT_PUBLIC_API_MODE === 'real' ? 'real' : 'mock';
}

export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? '';
}

/**
 * The S1 contract (docs/slices/s1-identity.md) fixes __Host-invision_* cookie
 * names for staging, where cookies are Secure and served over HTTPS. __Host-
 * prefixed cookies cannot be set over plain HTTP, so local development needs a
 * distinct, non-prefixed equivalent. This is a frontend-local naming choice,
 * not yet written into openapi.yaml; coordinate with the backend owner before
 * relying on it outside mock mode.
 */
export const CSRF_COOKIE_NAMES = ['__Host-invision_csrf', 'invision_csrf'] as const;
