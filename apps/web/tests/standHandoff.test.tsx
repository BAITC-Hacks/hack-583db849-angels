import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationControl } from '../components/home/AccommodationControl';
import type { WireCandidate } from '../lib/api/contract';
import { useMe } from '../lib/api/candidates';
import { DEMO_CANDIDATE_COOKIE, setDemoCandidate } from '../lib/demo/currentCandidate';
import { useHomeProgress } from '../lib/home/useHomeProgress';
import { continueAs, sendApplication } from '../lib/stand/handoff';
import { DEMO_APPLICANT_ID, READY_APPLICANT_ID } from '../mocks/accounts';
import { findSubmission, platformSnapshot, readiness } from '../mocks/platformExport';
import { seedDemoJourney } from '../mocks/seed';
import { example, hookWithQuery, json, mockApi, withQuery } from './apiHarness';

/**
 * The stand and the AI layer, joined: an applicant sends the application on
 * the stand, the platform hands it to `POST /v1/candidates`, and the
 * applicant carries on in the AI layer as that candidate — while staff see
 * them next to A, B and C.
 */
const list = example<{ items: WireCandidate[] }>('candidates.json');
const STAND_ID = '6f1c2a0e-0000-4000-8000-0000000057a1';
const fromStand: WireCandidate = {
  ...list.items[0],
  candidateId: STAND_ID,
  label: 'Candidate 7773',
  progress: { ...list.items[0].progress!, candidateId: STAND_ID, label: 'Candidate 7773', simulation: null, assessment: null, interview: null },
};

function cookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

beforeAll(() => seedDemoJourney());
afterEach(() => {
  setDemoCandidate(null);
  document.cookie = 'invision-demo-role=; path=/; max-age=0';
});

describe('the platform’s snapshot of an application', () => {
  it('holds the answers in the applicant’s words, the test, the certificate — and the profile for the API alone', () => {
    const snapshot = platformSnapshot(READY_APPLICANT_ID)!;
    expect(snapshot.externalId).toBe(`stand-${READY_APPLICANT_ID}`);
    const fields = snapshot.application.answers.map((answer) => answer.fieldId);
    expect(fields).toEqual(expect.arrayContaining(['motivation', 'leadership_example', 'setback', 'community', 'english_self']));
    expect(fields).not.toContain('english_certificate');
    expect(snapshot.application.answers.find((answer) => answer.fieldId === 'english_self')?.answer).toBe('B2 — upper intermediate');
    expect(snapshot.test.answers).toHaveLength(10);
    expect(snapshot.test.answers[0].response).toMatch(/^Most like me: .+ Least like me: .+$/);
    expect(snapshot.englishCertificate).toEqual({ type: 'IELTS', score: '6.0' });
    expect(snapshot.profile).toMatchObject({ fullName: 'Ready Applicant', email: 'applicant.ready@example.test' });
  });

  it('is ready to send only with every required answer and the whole test', () => {
    expect(readiness(READY_APPLICANT_ID)).toEqual({ missing: [], testComplete: true, ready: true });
    const fresh = readiness(DEMO_APPLICANT_ID);
    expect(fresh.ready).toBe(false);
    expect(fresh.testComplete).toBe(false);
    expect(fresh.missing).toEqual(expect.arrayContaining(['Why inVision U?', 'How would you rate your English?']));
  });
});

describe('sending it to the AI layer', () => {
  it('posts the snapshot under the platform’s key once, and carries the applicant on as that candidate', async () => {
    const calls = mockApi({ 'POST /api/v1/candidates': () => json({ ...fromStand, progress: undefined }, 201) });

    const candidateId = await sendApplication(READY_APPLICANT_ID, 'key-1');

    expect(candidateId).toBe(STAND_ID);
    const post = calls.find((call) => call.method === 'POST')!;
    expect(JSON.parse(post.body as string)).toEqual(platformSnapshot(READY_APPLICANT_ID));
    expect(post.headers.get('Idempotency-Key')).toBe('key-1');
    // The candidate role is the one the BFF sends under the platform key.
    expect(cookie('invision-demo-role')).toBe('candidate');
    expect(findSubmission(READY_APPLICANT_ID)?.candidateId).toBe(STAND_ID);

    continueAs(candidateId);
    expect(cookie(DEMO_CANDIDATE_COOKIE)).toBe(STAND_ID);
  });
});

describe('the candidate screens and the staff homes', () => {
  it('show the candidate the stand sent, and candidate A otherwise', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json({ items: [...list.items, fromStand] }) });
    const { result } = hookWithQuery(() => useMe());
    await waitFor(() => expect(result.current.me?.label).toBe('Candidate A'));

    act(() => setDemoCandidate(STAND_ID));
    expect(result.current.me?.candidateId).toBe(STAND_ID);
  });

  it('list the stand’s applicants after A, B and C, by their own tag — never as a seed', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json({ items: [...list.items, fromStand] }) });
    const { result } = hookWithQuery(() => useHomeProgress());
    await waitFor(() => expect(result.current.rows.map((row) => row.tag)).toEqual(['A', 'B', 'C', '7773']));
    const row = result.current.rows[3];
    expect(row).toMatchObject({ code: null, id: STAND_ID });
    // A label ending in B or C is still not candidate B or C.
    expect(result.current.candidates.A.id).toBe(list.items[0].candidateId);
  });

  it('let staff give a stand applicant the typing accommodation, like A, B and C', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json({ items: [...list.items, fromStand] }) });
    withQuery(<AccommodationControl />);
    expect(await screen.findByText('Candidate 7773')).toBeTruthy();
    expect(screen.getByText('Candidate A')).toBeTruthy();
  });
});
