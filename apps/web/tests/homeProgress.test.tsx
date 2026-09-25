import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { somethingPending } from '../lib/api/candidates';
import type { WireCandidate } from '../lib/api/contract';
import { forgetViewedBriefs, markBriefViewed } from '../lib/brief/viewed';
import { useHomeProgress } from '../lib/home/useHomeProgress';
import CommissionHome from '../app/(product)/commission/page';
import { example, hookWithQuery, json, mockApi, withQuery } from './apiHarness';

const list = example<{ items: WireCandidate[] }>('candidates.json');

beforeEach(() => forgetViewedBriefs());
afterEach(() => vi.unstubAllGlobals());

describe('where each candidate is, for the staff homes', () => {
  it('takes the brief, the simulation and the report from the API, and the id links need', async () => {
    const withIds = { items: list.items.map((item) => ({ ...item, candidateId: `api-${item.label}`, progress: { ...item.progress!, candidateId: `api-${item.label}` } })) };
    mockApi({ 'GET /api/v1/candidates': () => json(withIds) });
    const { result } = hookWithQuery(() => useHomeProgress());
    await waitFor(() => expect(result.current.candidates.A.simulation).toBe('completed'));
    expect(result.current.candidates.A).toMatchObject({ id: 'api-Candidate A', brief: 'ready', assessmentReady: true, assessment: 'ready' });
    // Whether the brief was opened is known to this tab only (G13).
    expect(result.current.candidates.A.briefViewed).toBe(false);
    act(() => markBriefViewed('api-Candidate A'));
    expect(result.current.candidates.A).toMatchObject({ briefViewed: true, brief: 'ready' });
  });

  it('shows nothing as done when the API cannot be read', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json({ error: { code: 'AI_UNAVAILABLE', message: 'down' } }, 503) });
    const { result } = hookWithQuery(() => useHomeProgress());
    await waitFor(() => expect(result.current.apiError).not.toBeNull());
    expect(result.current.candidates.A).toMatchObject({ brief: null, simulation: 'not-started', assessmentReady: false });
  });

  it('says so on the commission home when the API cannot be read', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json({ error: { code: 'AI_UNAVAILABLE', message: 'down' } }, 503) });
    withQuery(<CommissionHome />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/may be out of date/);
  });

  it('tells the commission what comes next: preparing, failed, or not finished', async () => {
    const at = (simulation: unknown, assessment: unknown) => ({
      items: list.items.map((item, index) => (index === 0 ? { ...item, progress: { ...item.progress!, simulation, assessment } } : item)),
    });
    const done = { simulationId: 's', status: 'completed', ending: 'completed' };
    mockApi({ 'GET /api/v1/candidates': () => json(at(done, { assessmentId: 'a', status: 'pending' })) });
    const preparing = withQuery(<CommissionHome />);
    expect(await screen.findByText('Candidate A’s report is being prepared')).toBeTruthy();
    preparing.unmount();

    mockApi({ 'GET /api/v1/candidates': () => json(at(done, { assessmentId: 'a', status: 'failed' })) });
    const failed = withQuery(<CommissionHome />);
    expect(await screen.findByText('The assessment of candidate A failed')).toBeTruthy();
    failed.unmount();

    mockApi({ 'GET /api/v1/candidates': () => json(at(null, null)) });
    withQuery(<CommissionHome />);
    expect(await screen.findByText('Candidate A has not finished the simulation')).toBeTruthy();
  });

  it('polls only while a brief or an assessment is being written, or a simulation runs', () => {
    const at = (simulation: unknown, assessment: unknown, brief: unknown = null) =>
      [{ ...list.items[0], progress: { ...list.items[0].progress!, simulation, assessment, brief } }] as WireCandidate[];
    expect(somethingPending(at(null, null, { briefId: null, status: 'pending' }))).toBe(true);
    expect(somethingPending(at(null, null, { briefId: 'b', status: 'failed' }))).toBe(false);
    const waitingForAfter = [{ ...list.items[0], progress: { ...list.items[0].progress!, simulation: null, assessment: null, brief: null, consistency: { before: 'ready', after: 'pending' } } }] as WireCandidate[];
    expect(somethingPending(waitingForAfter)).toBe(true);
    expect(somethingPending(at({ simulationId: 's', status: 'active', ending: null }, null))).toBe(true);
    expect(somethingPending(at(null, { assessmentId: 'a', status: 'pending' }))).toBe(true);
    expect(somethingPending(at({ simulationId: 's', status: 'completed', ending: 'completed' }, { assessmentId: 'a', status: 'ready' }))).toBe(false);
    expect(somethingPending(undefined)).toBe(false);
  });
});
