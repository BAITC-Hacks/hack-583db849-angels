import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { somethingPending } from '../lib/api/candidates';
import type { WireCandidate } from '../lib/api/contract';
import { record, resetWorld } from '../lib/demo/world';
import { useHomeProgress } from '../lib/home/useHomeProgress';
import { example, hookWithQuery, json, mockApi } from './apiHarness';

const list = example<{ items: WireCandidate[] }>('candidates.json');

beforeEach(() => resetWorld());
afterEach(() => vi.unstubAllGlobals());

describe('where each candidate is, for the staff homes', () => {
  it('takes the simulation and the report from the API, and the brief from the world until #11', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list) });
    const { result } = hookWithQuery(() => useHomeProgress());
    await waitFor(() => expect(result.current.candidates.A.simulation).toBe('completed'));
    expect(result.current.candidates.A.assessmentReady).toBe(true);
    expect(result.current.candidates.A.assessment).toBe('ready');
    expect(result.current.candidates.A.briefViewed).toBe(false);

    act(() => record('brief-viewed', 'A', { briefViewed: true }));
    expect(result.current.candidates.A).toMatchObject({ briefViewed: true, simulation: 'completed' });
  });

  it('shows nothing as done when the API cannot be read', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json({ error: { code: 'AI_UNAVAILABLE', message: 'down' } }, 503) });
    const { result } = hookWithQuery(() => useHomeProgress());
    await waitFor(() => expect(result.current.apiError).not.toBeNull());
    expect(result.current.candidates.A).toMatchObject({ simulation: 'not-started', assessmentReady: false });
  });

  it('polls only while a simulation runs or an assessment is being written', () => {
    const at = (simulation: unknown, assessment: unknown) =>
      [{ ...list.items[0], progress: { ...list.items[0].progress!, simulation, assessment } }] as WireCandidate[];
    expect(somethingPending(at({ simulationId: 's', status: 'active', ending: null }, null))).toBe(true);
    expect(somethingPending(at(null, { assessmentId: 'a', status: 'pending' }))).toBe(true);
    expect(somethingPending(at({ simulationId: 's', status: 'completed', ending: 'completed' }, { assessmentId: 'a', status: 'ready' }))).toBe(false);
    expect(somethingPending(undefined)).toBe(false);
  });
});
