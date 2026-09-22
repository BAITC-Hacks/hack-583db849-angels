import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertMatchesSchema } from './schema';
import { call, clearCookies, readCookie, server } from './mockServer';

/**
 * The four logout paths the contract fixes (D-018, CON-017). They exist as
 * separate cases because the bug they replace was precisely that two of them
 * behaved differently: a present but expired cookie skipped CSRF validation and
 * answered 204, which told a caller the session was already gone.
 */
const DEMO = { email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' };

async function signIn(): Promise<void> {
  await call('/auth/login', { method: 'POST', body: JSON.stringify(DEMO) });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => clearCookies());

describe('logout', () => {
  it('answers an anonymous call with 204 and asks for no CSRF', async () => {
    const { status } = await call('/auth/logout', { method: 'POST' });

    expect(status).toBe(204);
  });

  it('ends every session for a valid cookie with a valid CSRF header', async () => {
    await signIn();
    const csrf = readCookie('invision_csrf') ?? '';

    const { status } = await call('/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrf },
    });

    expect(status).toBe(204);
    expect(readCookie('invision_refresh')).toBeUndefined();

    // The session is revoked server-side, not merely forgotten by the browser.
    const after = await call('/auth/me');
    expect(after.status).toBe(401);
  });

  it('refuses a present cookie with no CSRF header and changes nothing', async () => {
    await signIn();
    const before = readCookie('invision_refresh');

    const { status, body } = await call('/auth/logout', { method: 'POST' });

    expect(status).toBe(403);
    assertMatchesSchema('ApiError', body);
    expect((body as { code: string }).code).toBe('CSRF_VALIDATION_FAILED');

    // Nothing cleared and nothing revoked: a forged request must not be able to
    // log someone out.
    expect(readCookie('invision_refresh')).toBe(before);
    const stillSignedIn = await call('/auth/me');
    expect(stillSignedIn.status).toBe(200);
  });

  it('refuses a present cookie with a wrong CSRF header', async () => {
    await signIn();

    const { status, body } = await call('/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'not-the-token' },
    });

    expect(status).toBe(403);
    expect((body as { code: string }).code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('applies the same CSRF rule to a cookie that no longer resolves to a session', async () => {
    await signIn();
    const csrf = readCookie('invision_csrf') ?? '';

    // Log out once, then forge the cookies back: the refresh token is now stale.
    await call('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf } });
    document.cookie = 'invision_refresh=expired-session-id; Path=/';

    const refused = await call('/auth/logout', { method: 'POST' });
    expect(refused.status).toBe(403);

    // With the CSRF header it answers exactly as a live session would, so the
    // response does not disclose that the session was already gone.
    document.cookie = `invision_csrf=${csrf}; Path=/`;
    const accepted = await call('/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(accepted.status).toBe(204);
  });
});
