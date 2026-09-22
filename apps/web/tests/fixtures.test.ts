import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertMatchesSchema } from './schema';
import { call, clearCookies, readCookie, server } from './mockServer';

/**
 * Every mock response is checked against the schema the contract declares for
 * it, so a fixture cannot drift away from openapi.yaml unnoticed. This is the
 * schema-validated MSW that #26 requires; the runtime conformance of the real
 * API is #21 and is not touched here.
 */
const applicant = {
  email: 'fixture.applicant@example.test',
  iin: '111122223333',
  fullName: 'Fixture Applicant',
  birthYear: 2005,
  password: 'synthetic-fixture-passphrase',
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => clearCookies());

describe('mock fixtures match the contract', () => {
  it('registration returns an AuthSession', async () => {
    const { status, body } = await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...applicant, email: `r-${Date.now()}@example.test`, iin: '444455556666' }),
    });

    expect(status).toBe(201);
    assertMatchesSchema('AuthSession', body);
  });

  it('sign-in returns an AuthSession for the seeded demo applicant', async () => {
    const { status, body } = await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' }),
    });

    expect(status).toBe(200);
    assertMatchesSchema('AuthSession', body);
  });

  it('the current user matches UserPublic and never exposes the IIN', async () => {
    await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' }),
    });

    const { status, body } = await call('/auth/me');

    expect(status).toBe(200);
    assertMatchesSchema('UserPublic', body);
    expect(JSON.stringify(body)).not.toContain('000000000000');
  });

  it('a rejected sign-in returns the error envelope', async () => {
    const { status, body } = await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'wrong-but-long-enough-passphrase' }),
    });

    expect(status).toBe(401);
    assertMatchesSchema('ApiError', body);
    expect((body as { code: string }).code).toBe('INVALID_CREDENTIALS');
  });

  it('a duplicate registration stays neutral about which identifier exists', async () => {
    const { status, body } = await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...applicant, email: 'applicant.demo@example.test' }),
    });

    expect(status).toBe(400);
    assertMatchesSchema('ApiError', body);
    expect((body as { code: string }).code).toBe('REGISTRATION_FAILED');
    expect(body).not.toHaveProperty('details.fields');
  });

  it('field errors are reported against the contract envelope', async () => {
    const { status, body } = await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...applicant, iin: '12', password: 'short' }),
    });

    expect(status).toBe(400);
    assertMatchesSchema('ApiError', body);
    expect((body as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('refresh rotates the session and returns an AuthSession', async () => {
    await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' }),
    });

    const before = readCookie('invision_refresh');
    const csrf = readCookie('invision_csrf');

    const { status, body } = await call('/auth/refresh', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrf ?? '' },
    });

    expect(status).toBe(200);
    assertMatchesSchema('AuthSession', body);
    expect(readCookie('invision_refresh')).not.toBe(before);
  });

  it('refresh without the CSRF header is refused', async () => {
    await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' }),
    });

    const { status, body } = await call('/auth/refresh', { method: 'POST' });

    expect(status).toBe(403);
    assertMatchesSchema('ApiError', body);
    expect((body as { code: string }).code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('health matches the contract', async () => {
    const { status, body } = await call('/health');

    expect(status).toBe(200);
    assertMatchesSchema('Health', body);
  });
});

describe('the seeded demo applicant', () => {
  it('is available from memory on every fresh start', async () => {
    const { status } = await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' }),
    });

    expect(status).toBe(200);
  });
});
