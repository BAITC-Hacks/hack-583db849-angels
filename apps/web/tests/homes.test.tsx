import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommissionHome from '../app/(product)/commission/page';
import InterviewerHome from '../app/(product)/interviewer/page';
import type { WireCandidate } from '../lib/api/contract';
import { forgetViewedBriefs, markBriefViewed } from '../lib/brief/viewed';
import { example, json, mockApi, withQuery } from './apiHarness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/' }));

beforeEach(() => {
  vi.useFakeTimers();
  forgetViewedBriefs();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('each role has its own working home', () => {
  const list = example<{ items: WireCandidate[] }>('candidates.json');
  const withProgress = (simulation: unknown, assessment: unknown) => ({
    items: list.items.map((item, index) =>
      index === 0 ? { ...item, progress: { ...item.progress!, simulation, assessment } } : item,
    ),
  });

  it('moves the interviewer’s next step forward as the interview does', async () => {
    vi.useRealTimers();
    const at = (interview: unknown) => ({ items: list.items.map((item, index) => (index === 0 ? { ...item, progress: { ...item.progress!, interview } } : item)) });
    mockApi({ 'GET /api/v1/candidates': () => json(at(null)) });
    const first = withQuery(<InterviewerHome />);
    expect(screen.getByText('Read candidate A’s brief')).toBeTruthy();
    act(() => markBriefViewed(list.items[0].candidateId));
    expect(await screen.findByText('Interview candidate A and record it')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the interview' }).getAttribute('href')).toBe('/interviewer/interview');
    first.unmount();

    mockApi({ 'GET /api/v1/candidates': () => json(at({ interviewId: 'interview-1', transcriptStatus: 'ready', scoresSaved: false, draftReady: false })) });
    withQuery(<InterviewerHome />);
    expect(await screen.findByText('Score candidate A blind')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Score now' }).getAttribute('href')).toBe('/interviewer/interview/interview-1');
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
    // One simulation finished, one report ready and one interview scored, all from the API.
    expect(screen.getAllByText('1 / 3')).toHaveLength(3);
  });
});
