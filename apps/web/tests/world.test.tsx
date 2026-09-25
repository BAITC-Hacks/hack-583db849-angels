import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommissionHome from '../app/(product)/commission/page';
import InterviewerHome from '../app/(product)/interviewer/page';
import { AssessmentGate } from '../components/home/AssessmentGate';
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
  it('moves the interviewer’s next step forward as things happen', () => {
    render(<InterviewerHome />);
    expect(screen.getByText('Read candidate A’s brief')).toBeTruthy();
    act(() => record('brief-viewed', 'A', { briefViewed: true }));
    expect(screen.getByText('Interview candidate A and record it')).toBeTruthy();
    act(() => record('transcript-ready', 'A', { transcript: 'ready' }));
    expect(screen.getByText('Score candidate A blind')).toBeTruthy();
  });

  it('opens the report for the commission only once the simulation is finished', () => {
    mockApi({ 'GET /api/v1/candidates': () => json(example<{ items: WireCandidate[] }>('candidates.json')) });
    withQuery(<CommissionHome />);
    expect(screen.queryByRole('link', { name: 'Open report' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use the recorded session' }));
    expect(screen.getAllByRole('link', { name: /Open (the )?report/ }).length).toBeGreaterThan(0);
  });

  it('keeps the report behind the simulation', () => {
    render(
      <AssessmentGate audience="staff">
        <p>report body</p>
      </AssessmentGate>,
    );
    expect(screen.queryByText('report body')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use the recorded session' }));
    expect(screen.getByText('report body')).toBeTruthy();
  });
});
