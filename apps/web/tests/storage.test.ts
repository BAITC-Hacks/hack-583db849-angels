import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, clearCookies, readCookie, server } from './mockServer';

/**
 * The storage rule, asserted permanently.
 *
 * Browser storage may hold the theme preference and a marker naming which
 * synthetic account is signed in — an opaque seeded id, nothing more. Mock
 * users, registration state, S2 drafts, test answers and video state live in
 * tab memory only, and the real mode stores no applicant data, no tokens and no
 * session at all — that stays server-side, PostgreSQL plus HttpOnly cookies.
 *
 * This test exists because the rule is easy to break by accident: the previous
 * implementation persisted the whole mock database, and MSW quietly mirrored
 * every Set-Cookie into localStorage as well. Both were found by inspecting a
 * running browser, not by reading the code.
 */
const THEME_KEY = 'invision-theme';
const SESSION_MARKER_KEY = 'invision-mock-session';
/** Fixed in mocks/db.ts so a marker still resolves after a reload. */
const DEMO_APPLICANT_ID = '77777777-7777-4777-8777-777777777771';

function storageSnapshot(): Record<string, string> {
  return Object.fromEntries(Object.entries(localStorage));
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  localStorage.clear();
  clearCookies();
});

describe('browser storage', () => {
  it('stays empty through registration, sign-in and a rejected attempt', async () => {
    await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `storage-${Date.now()}@example.test`,
        iin: '777788889999',
        fullName: 'Storage Check',
        birthYear: 2004,
        password: 'synthetic-storage-passphrase',
      }),
    });

    await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' }),
    });

    await call('/auth/me');

    await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'wrong-but-long-enough-passphrase' }),
    });

    // Signing in leaves a marker and nothing else: no token, no cookie mirror,
    // no user object.
    expect(Object.keys(storageSnapshot())).toEqual([SESSION_MARKER_KEY]);
    expect(localStorage.getItem(SESSION_MARKER_KEY)).toBe(DEMO_APPLICANT_ID);
  });

  it('marks only which seeded account is signed in, never one created in the tab', async () => {
    const email = `fresh-${Date.now()}@example.test`;

    await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        iin: '555566667777',
        fullName: 'Fresh Applicant',
        birthYear: 2005,
        password: 'synthetic-fresh-passphrase',
      }),
    });

    // Registration signs the new account in, but it exists only in this tab —
    // a marker pointing at it would promise a session the mock cannot restore.
    expect(localStorage.getItem(SESSION_MARKER_KEY)).toBeNull();
    expect(JSON.stringify(storageSnapshot())).not.toContain(email);
  });

  it('forgets the account when every session is revoked', async () => {
    await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' }),
    });
    expect(localStorage.getItem(SESSION_MARKER_KEY)).toBe(DEMO_APPLICANT_ID);

    await call('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': readCookie('invision_csrf') ?? '' } });

    expect(localStorage.getItem(SESSION_MARKER_KEY)).toBeNull();
  });

  it('never contains an IIN, a passphrase or a session identifier', async () => {
    const iin = '123409876543';
    const password = 'synthetic-secret-passphrase';

    await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `secrets-${Date.now()}@example.test`,
        iin,
        fullName: 'Secret Check',
        birthYear: 2003,
        password,
      }),
    });

    const dump = JSON.stringify(storageSnapshot());

    expect(dump).not.toContain(iin);
    expect(dump).not.toContain(password);
    expect(dump).not.toContain('invision-mock-db');
    expect(dump).not.toContain('msw-cookie-store');
    // The access cookie is a session identifier; the marker must not be one.
    expect(dump).not.toContain(readCookie('invision_access') ?? 'no-session-cookie');
  });

  it('leaves the theme preference alone', () => {
    localStorage.setItem(THEME_KEY, 'dark');

    expect(Object.keys(storageSnapshot())).toEqual([THEME_KEY]);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });
});
