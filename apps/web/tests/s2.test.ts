import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CYCLE_ID, FORM_VERSION_ID, resetS2, scenario } from '../mocks/s2';
import { assertMatchesSchema } from './schema';
import { call, clearCookies, readCookie, server } from './mockServer';

/**
 * The S2 draft contract as the mock implements it. Each case is one of the
 * behaviours the specification fixes, and the ones that protect an applicant's
 * work — no second draft, no silent overwrite, no disclosure of someone else's
 * application — are asserted rather than assumed.
 */
const DEMO = { email: 'applicant.demo@example.test', password: 'synthetic-demo-passphrase' };

async function signIn(): Promise<void> {
  await call('/auth/login', { method: 'POST', body: JSON.stringify(DEMO) });
}

function csrf(): Record<string, string> {
  return { 'X-CSRF-Token': readCookie('invision_csrf') ?? '' };
}

async function startDraft(): Promise<{ id: string; revision: number }> {
  const { body } = await call('/applications', {
    method: 'POST',
    headers: csrf(),
    body: JSON.stringify({ cycleId: CYCLE_ID }),
  });
  return body as { id: string; revision: number };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
  resetS2();
  clearCookies();
  localStorage.clear();
  await signIn();
});

describe('active cycle', () => {
  it('returns the approved seed', async () => {
    const { status, body } = await call('/application-cycles/active');

    expect(status).toBe(200);
    assertMatchesSchema('ActiveCycle', body);
    expect((body as { id: string }).id).toBe(CYCLE_ID);
    expect((body as { formVersion: { id: string } }).formVersion.id).toBe(FORM_VERSION_ID);
  });

  it('reports a closed admissions window as its own state, not as a failure', async () => {
    scenario.cycleIsOpen = false;

    const { status, body } = await call('/application-cycles/active');

    expect(status).toBe(404);
    assertMatchesSchema('ApiError', body);
    expect((body as { code: string }).code).toBe('NO_ACTIVE_APPLICATION_CYCLE');
  });

  it('refuses an anonymous reader', async () => {
    clearCookies();

    const { status, body } = await call('/application-cycles/active');

    expect(status).toBe(401);
    assertMatchesSchema('ApiError', body);
  });
});

describe('creating a draft', () => {
  it('returns a DRAFT bound to the published form version', async () => {
    const { status, body } = await call('/applications', {
      method: 'POST',
      headers: csrf(),
      body: JSON.stringify({ cycleId: CYCLE_ID }),
    });

    expect(status).toBe(201);
    assertMatchesSchema('ApplicationDraft', body);
    expect(body).toMatchObject({ status: 'DRAFT', revision: 0, answers: {} });
  });

  it('answers the second attempt with a conflict instead of a duplicate', async () => {
    await startDraft();

    const { status, body } = await call('/applications', {
      method: 'POST',
      headers: csrf(),
      body: JSON.stringify({ cycleId: CYCLE_ID }),
    });

    expect(status).toBe(409);
    expect((body as { code: string }).code).toBe('APPLICATION_ALREADY_EXISTS');
  });

  it('requires the CSRF header', async () => {
    const { status, body } = await call('/applications', {
      method: 'POST',
      body: JSON.stringify({ cycleId: CYCLE_ID }),
    });

    expect(status).toBe(403);
    expect((body as { code: string }).code).toBe('CSRF_VALIDATION_FAILED');
  });
});

describe('reading the current draft', () => {
  it('reports no draft as not found rather than as an error', async () => {
    const { status, body } = await call('/applications/current');

    expect(status).toBe(404);
    assertMatchesSchema('ApiError', body);
    expect((body as { code: string }).code).toBe('APPLICATION_NOT_FOUND');
  });

  it('returns the draft with the form version bound to it', async () => {
    await startDraft();

    const { status, body } = await call('/applications/current');

    expect(status).toBe(200);
    assertMatchesSchema('ApplicationDraft', body);
    expect((body as { formVersion: { id: string } }).formVersion.id).toBe(FORM_VERSION_ID);
  });
});

describe('saving answers', () => {
  it('merges the supplied keys and increments the revision', async () => {
    const draft = await startDraft();

    const first = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 0,
        answers: { intended_study_area: 'Product management' },
      }),
    });

    expect(first.status).toBe(200);
    assertMatchesSchema('ApplicationDraft', first.body);
    expect(first.body).toMatchObject({ revision: 1, answers: { intended_study_area: 'Product management' } });

    const second = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 1,
        answers: { city_region: 'Almaty' },
      }),
    });

    // Omitted keys stay untouched: this is a merge, not a replacement.
    expect(second.body).toMatchObject({
      revision: 2,
      answers: { intended_study_area: 'Product management', city_region: 'Almaty' },
    });
  });

  it('removes an answer for null and for blank text', async () => {
    const draft = await startDraft();

    await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 0,
        answers: { intended_study_area: 'Product management', city_region: 'Almaty' },
      }),
    });

    const cleared = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 1,
        answers: { intended_study_area: null, city_region: '   ' },
      }),
    });

    expect((cleared.body as { answers: Record<string, unknown> }).answers).toEqual({});
  });

  it('refuses a stale revision instead of overwriting newer work', async () => {
    const draft = await startDraft();

    await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({ formVersionId: FORM_VERSION_ID, expectedRevision: 0, answers: { city_region: 'Almaty' } }),
    });

    const stale = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({ formVersionId: FORM_VERSION_ID, expectedRevision: 0, answers: { city_region: 'Astana' } }),
    });

    expect(stale.status).toBe(409);
    expect((stale.body as { code: string }).code).toBe('DRAFT_REVISION_CONFLICT');

    const current = await call('/applications/current');
    expect((current.body as { answers: Record<string, unknown> }).answers).toEqual({ city_region: 'Almaty' });
  });

  it('rejects a question the bound form does not contain', async () => {
    const draft = await startDraft();

    const { status, body } = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 0,
        answers: { motivation_letter: 'not part of S2' },
      }),
    });

    expect(status).toBe(400);
    expect((body as { code: string }).code).toBe('UNKNOWN_QUESTION');
  });

  it('rejects an answer of the wrong type and one outside its range', async () => {
    const draft = await startDraft();

    const wrongType = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 0,
        answers: { expected_graduation_year: 'soon' },
      }),
    });

    expect(wrongType.status).toBe(400);
    expect((wrongType.body as { code: string }).code).toBe('INVALID_ANSWER_TYPE');

    const outOfRange = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 0,
        answers: { expected_graduation_year: 1800 },
      }),
    });

    expect(outOfRange.status).toBe(400);
    expect((outOfRange.body as { code: string }).code).toBe('INVALID_ANSWER_VALUE');
  });

  it('rejects an option the question does not offer', async () => {
    const draft = await startDraft();

    const { status, body } = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 0,
        answers: { current_education_status: 'phd' },
      }),
    });

    expect(status).toBe(400);
    expect((body as { code: string }).code).toBe('INVALID_ANSWER_VALUE');
  });

  it('rejects a form version other than the one bound to the draft', async () => {
    const draft = await startDraft();

    const { status, body } = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: '33333333-3333-4333-8333-333333333333',
        expectedRevision: 0,
        answers: { city_region: 'Almaty' },
      }),
    });

    expect(status).toBe(400);
    expect((body as { code: string }).code).toBe('FORM_VERSION_MISMATCH');
  });

  it('does not disclose that another applicant has a draft', async () => {
    const draft = await startDraft();

    clearCookies();
    await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `other-${Date.now()}@example.test`,
        iin: '999988887777',
        fullName: 'Other Applicant',
        birthYear: 2004,
        password: 'synthetic-other-passphrase',
      }),
    });

    const { status, body } = await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({ formVersionId: FORM_VERSION_ID, expectedRevision: 0, answers: { city_region: 'Almaty' } }),
    });

    // Not found, never forbidden: the response must not confirm it exists.
    expect(status).toBe(404);
    expect((body as { code: string }).code).toBe('APPLICATION_NOT_FOUND');
  });
});

describe('browser storage during the draft flow', () => {
  it('stays empty while answers are saved', async () => {
    const draft = await startDraft();

    await call(`/applications/${draft.id}/answers`, {
      method: 'PATCH',
      headers: csrf(),
      body: JSON.stringify({
        formVersionId: FORM_VERSION_ID,
        expectedRevision: 0,
        answers: { intended_study_area: 'Product management', city_region: 'Almaty' },
      }),
    });

    const dump = JSON.stringify(Object.fromEntries(Object.entries(localStorage)));

    // The session marker is the only thing mock auth may leave behind; not one
    // answer, draft id or revision joins it.
    expect(Object.keys(localStorage)).toEqual(['invision-mock-session']);
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain(draft.id);
    expect(dump).not.toContain('Product management');
    expect(dump).not.toContain('Almaty');
  });
});
