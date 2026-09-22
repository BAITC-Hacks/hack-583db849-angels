import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommissionHome from '../app/(product)/commission/page';
import CandidateHome from '../app/(product)/candidate/page';
import InterviewerHome from '../app/(product)/interviewer/page';
import { AssessmentGate } from '../components/home/AssessmentGate';
import { getSimulation, getWorld, record, resetWorld } from '../lib/demo/world';
import { sampleScores } from '../lib/interview/preview';
import { getSharedInterviewStore } from '../lib/interview/store';
import { previewScenario } from '../lib/simulation/previewScenario';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/' }));

beforeEach(() => {
  vi.useFakeTimers();
  resetWorld();
});
afterEach(() => vi.useRealTimers());

const codes = () => getWorld().events.map((event) => event.code);

async function playSimulation() {
  const simulation = getSimulation();
  for (let turn = 1; turn <= previewScenario.maxCandidateTurns; turn += 1) {
    simulation.send(`Turn ${turn}`);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
  }
}

describe('the demo world', () => {
  it('follows the candidate through the simulation to the report', async () => {
    await playSimulation();
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
    const before = getSimulation();
    const interview = getSharedInterviewStore();
    record('brief-viewed', 'A', { briefViewed: true });
    resetWorld();
    expect(getWorld().candidates.A.briefViewed).toBe(false);
    expect(getSimulation()).not.toBe(before);
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
    render(<CommissionHome />);
    expect(screen.queryByRole('link', { name: 'Open report' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use the recorded session' }));
    expect(screen.getAllByRole('link', { name: /Open (the )?report/ }).length).toBeGreaterThan(0);
  });

  it('shows the candidate the simulation, then the feedback, never a score', async () => {
    const { container } = render(<CandidateHome />);
    expect(screen.getByRole('link', { name: /Start the simulation/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Read your feedback/ })).toBeNull();
    await playSimulation();
    expect(screen.getByRole('link', { name: /Read your feedback/ })).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d\s*\/\s*4|score:/i);
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
