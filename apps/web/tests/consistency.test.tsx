import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsistencyComparison } from '../components/consistency/ConsistencyComparison';
import { ConsistencyGate } from '../components/consistency/ConsistencyGate';
import { previewAfter, previewBefore } from '../lib/consistency/preview';
import { record, resetWorld } from '../lib/demo/world';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/' }));

beforeEach(() => resetWorld());

describe('what the interview settled', () => {
  it('shows each claim once, with both stages beside it', () => {
    render(<ConsistencyComparison before={previewBefore} after={previewAfter} />);

    // Candidate A's English: claimed C2, measured B2, and the interview agreed.
    expect(screen.getAllByText('Rates their English as C2.')).toHaveLength(1);
    expect(screen.getByText(/The simulation’s speech measured B2/)).toBeTruthy();
    expect(screen.getByText(/The simulation and the interview both measured B2/)).toBeTruthy();
    expect(screen.getAllByText('Confirmed in the interview').length).toBeGreaterThan(0);
  });

  it('says plainly when a question was never asked', () => {
    render(<ConsistencyComparison before={previewBefore} after={previewAfter} />);

    expect(screen.getAllByText('Not verified').length).toBeGreaterThan(0);
    expect(screen.getByText(/This was not settled in the interview/)).toBeTruthy();
  });

  it('gives a score to nobody', () => {
    const { container } = render(<ConsistencyComparison before={previewBefore} after={previewAfter} />);
    expect(container.textContent).not.toMatch(/\b(reject|accept|admit|score|rank)\w*/i);
  });
});

describe('the lock before the interviewer scores', () => {
  it('holds the comparison back, and says why', () => {
    render(
      <ConsistencyGate>
        <p>the comparison</p>
      </ConsistencyGate>,
    );

    expect(screen.queryByText('the comparison')).toBeNull();
    expect(screen.getByText('The interviewer has not scored yet')).toBeTruthy();
    expect(screen.getByText(/no longer scoring blind/)).toBeTruthy();
  });

  it('opens once the scores are saved', () => {
    record('scores-saved', 'A', { scoresSaved: true });
    render(
      <ConsistencyGate>
        <p>the comparison</p>
      </ConsistencyGate>,
    );

    expect(screen.getByText('the comparison')).toBeTruthy();
  });
});

describe('the preview itself', () => {
  it('keeps the same item ids across both stages, so nothing is quietly dropped', () => {
    const before = previewBefore.items.map((item) => item.itemId);
    for (const itemId of before) {
      expect(previewAfter.items.some((item) => item.itemId === itemId), itemId).toBe(true);
    }
  });

  it('asks a question for everything left open before the interview', () => {
    for (const item of previewBefore.items) {
      if (item.status === 'discrepancy' || item.status === 'unverified') {
        expect(item.askInInterview, item.itemId).toBeTruthy();
      }
    }
  });
});
