import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommissionHome from '../app/(product)/commission/page';
import InterviewerHome from '../app/(product)/interviewer/page';
import type { WireCandidate } from '../lib/api/contract';
import { getWorld, record, resetWorld } from '../lib/demo/world';
import { sampleScores } from '../lib/interview/preview';
import { getSharedInterviewStore } from '../lib/interview/store';
import { example, json, mockApi, withQuery } from './apiHarness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/' }));

beforeEach(() => {
  vi.useFakeTimers();
  resetWorld();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const codes = () => getWorld().events.map((event) => event.code);

/** What the simulation screen and the candidate home report while the other homes still read the world (#23). */
function playSimulation() {
  act(() => {
    record('simulation-started', 'A', { simulation: 'in-progress' });
    record('simulation-completed', 'A', { simulation: 'completed' });
    record('assessment-ready', 'A', { assessmentReady: true });
  });
}

describe('the demo world', () => {
  it('follows the candidate through the simulation to the report', () => {
    playSimulation();
    expect(getWorld().candidates.A).toMatchObject({ simulation: 'completed', assessmentReady: true });
    expect(codes()).toEqual(expect.arrayContaining(['simulation-started', 'simulation-completed', 'assessment-ready']));
  });

  it('records a step once, however often a screen reports it', () => {
    record('brief-viewed', 'A', { briefViewed: true });
    record('brief-viewed', 'A', { briefViewed: true });
    expect(codes().filter((code) => code === 'brief-viewed')).toHaveLength(1);
  });

  it('hears the interview: transcript, blind scores, draft', async () => {
    const store = getSharedInterviewStore();
    const transcribing = store.transcribe();
    await vi.advanceTimersByTimeAsync(2000);
    await transcribing;
    store.fill(sampleScores);
    const saving = store.save();
    await vi.advanceTimersByTimeAsync(2000);
    await saving;
    expect(getWorld().candidates.A).toMatchObject({ transcript: 'ready', scoresSaved: true, draftReady: true });
  });

  it('starts over on reset, with a fresh simulation and interview', async () => {
    const interview = getSharedInterviewStore();
    record('brief-viewed', 'A', { briefViewed: true });
    resetWorld();
    expect(getWorld().candidates.A.briefViewed).toBe(false);
    expect(getSharedInterviewStore()).not.toBe(interview);
    expect(codes()).toEqual(['demo-reset']);
  });
});

describe('each role has its own working home', () => {
  const list = example<{ items: WireCandidate[] }>('candidates.json');
  const withProgress = (simulation: unknown, assessment: unknown) => ({
    items: list.items.map((item, index) =>
      index === 0 ? { ...item, progress: { ...item.progress!, simulation, assessment } } : item,
    ),
  });

  it('moves the interviewer’s next step forward as things happen', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(withProgress(null, null)) });
    withQuery(<InterviewerHome />);
    expect(screen.getByText('Read candidate A’s brief')).toBeTruthy();
    act(() => record('brief-viewed', 'A', { briefViewed: true }));
    expect(screen.getByText('Interview candidate A and record it')).toBeTruthy();
    act(() => record('transcript-ready', 'A', { transcript: 'ready' }));
    expect(screen.getByText('Score candidate A blind')).toBeTruthy();
  });

  it('shows the commission the simulation and the report as the API has them', async () => {
    vi.useRealTimers();
    mockApi({ 'GET /api/v1/candidates': () => json(withProgress({ simulationId: 's', status: 'active', ending: null }, null)) });
    const running = withQuery(<CommissionHome />);
    expect(await screen.findByText('In progress')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open report' })).toBeNull();
    running.unmount();

    mockApi({ 'GET /api/v1/candidates': () => json(list) });
    withQuery(<CommissionHome />);
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Open (the )?report/ }).length).toBeGreaterThan(0));
    // One simulation finished and one report ready, both from the API.
    expect(screen.getAllByText('1 / 3')).toHaveLength(2);
  });
});
