import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';
import { s2Handlers } from '../mocks/s2Handlers';
import { s3Handlers } from '../mocks/s3Handlers';

/**
 * The same handlers the browser uses, served over Node for tests.
 *
 * They read and write `document.cookie`, which jsdom provides, so the mock
 * session behaves here exactly as it does in the app — including the part that
 * matters most: nothing is written to browser storage.
 */
export const server = setupServer(...handlers, ...s2Handlers, ...s3Handlers);

/**
 * Handlers register relative paths, which MSW resolves against the document
 * origin — so requests in tests have to use jsdom's origin, not a guess.
 */
export const API = globalThis.location?.origin ?? 'http://localhost:3000';

export async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

export function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.trim().split('=')[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}
