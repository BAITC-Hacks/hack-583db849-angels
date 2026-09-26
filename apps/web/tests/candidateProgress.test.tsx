import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CandidateHome from '../app/(product)/candidate/page';
import type { WireCandidate, WireCandidateProgress } from '../lib/api/contract';
import { candidateTasks } from '../lib/candidate/journey';
import { example, json, mockApi, withQuery } from './apiHarness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/' }));

/**
 * The home tells a candidate where their application stands: how much of
 * their own part is done, how much time it still takes, what is next and when
 * to expect an answer. It counts steps; it never says how anything went.
 */
const list = example<{ items: WireCandidate[] }>('candidates.json');
const withProgress = (changes: Partial<WireCandidateProgress>) => ({
  items: list.items.map((item, index) => (index === 0 ? { ...item, progress: { ...item.progress!, ...changes } } : item)),
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the candidate’s own steps', () => {
  it('count the simulation, the question, the presentation and the interview — not the feedback', () => {
    const tasks = candidateTasks(withProgress({}).items[0].progress);
    expect(tasks.map((task) => [task.anchor, task.state])).toEqual([
      ['step-simulation', 'done'],
      ['step-question', 'done'],
      ['step-presentation', 'todo'],
      ['step-interview', 'todo'],
    ]);
  });
});

describe('the progress on the candidate home', () => {
  it('shows how much is done, the time left and the next step, with no marks', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list) });
    const { container } = withQuery(<CandidateHome />);

    expect(await screen.findByText('Your application is 50% complete')).toBeTruthy();
    expect(screen.getByText(/2 of 4 steps done · about 35 minutes of your time left/)).toBeTruthy();
    const next = screen.getByRole('link', { name: 'Go to this step' });
    expect(next.getAttribute('href')).toBe('#step-presentation');
    expect(container.querySelector('#step-presentation')).not.toBeNull();
    expect(screen.getByText('Not booked yet')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'How admission goes' })).getAllByRole('listitem')).toHaveLength(5);
    expect(container.textContent).not.toMatch(/score:|rating|\d\s*\/\s*\d/i);
  });

  it('shows the booked interview in Almaty time and how many days away it is', async () => {
    // Monday 28 September, 09:00 in Almaty; the interview is on Wednesday at 10:00.
    vi.useFakeTimers({ now: new Date('2026-09-28T04:00:00Z'), shouldAdvanceTime: true });
    mockApi({
      'GET /api/v1/candidates': () =>
        json(withProgress({ interviewSlot: { slotId: 'slot-1', startsAt: '2026-09-30T05:00:00.000Z', status: 'booked' } })),
    });
    withQuery(<CandidateHome />);

    expect(await screen.findByText('Wednesday, September 30, 10:00')).toBeTruthy();
    expect(screen.getByText('In 2 days · Almaty time (UTC+5)')).toBeTruthy();
  });

  it('says the candidate’s part is done once every step is', async () => {
    mockApi({
      'GET /api/v1/candidates': () =>
        json(
          withProgress({
            presentation: { presentationId: 'p-1', status: 'ready' },
            interviewSlot: { slotId: 'slot-1', startsAt: '2026-09-25T05:00:00.000Z', status: 'done' },
          }),
        ),
    });
    withQuery(<CandidateHome />);

    expect(await screen.findByText('Your part is done')).toBeTruthy();
    expect(screen.getByText(/4 of 4 steps done · nothing more to do for now/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Go to this step' })).toBeNull();
    expect(screen.getByText('Review by people').textContent).toMatch(/now/);
  });
});
