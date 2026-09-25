import type { components } from '@invision/api-client';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsistencyComparison } from '../components/consistency/ConsistencyComparison';
import { ConsistencyScreen } from '../components/consistency/ConsistencyScreen';
import type { WireCandidate } from '../lib/api/contract';
import { toConsistencyReport } from '../lib/api/mappers/consistency';
import { example, json, mockApi, withQuery } from './apiHarness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => '/' }));

type WireReport = components['schemas']['ConsistencyReportDto'];
const wireBefore = example<WireReport>('consistency-before.json');
const wireAfter = example<WireReport>('consistency-after.json');
const before = toConsistencyReport(wireBefore);
const after = toConsistencyReport(wireAfter);
const list = example<{ items: WireCandidate[] }>('candidates.json');
const candidateId = list.items[0].candidateId;
const path = `/api/v1/candidates/${candidateId}/consistency`;

function withProgress(interview: unknown, consistency: unknown) {
  return { items: list.items.map((item, index) => (index === 0 ? { ...item, progress: { ...item.progress!, interview, consistency } } : item)) };
}

afterEach(() => vi.unstubAllGlobals());

describe('what the interview settled', () => {
  it('shows each claim once, with both stages beside it', () => {
    render(<ConsistencyComparison before={before} after={after} />);
    // Candidate A's English: claimed C2, measured B2, and the interview agreed.
    expect(screen.getAllByText(before.items[0].claim.text)).toHaveLength(1);
    expect(screen.getByText(before.items[0].observation.text)).toBeTruthy();
    expect(screen.getByText(after.items[0].observation.text)).toBeTruthy();
    expect(screen.getAllByText('Confirmed in the interview').length).toBeGreaterThan(0);
  });

  it('says plainly when a question was never asked', () => {
    render(<ConsistencyComparison before={before} after={after} />);
    expect(screen.getAllByText('Not verified').length).toBeGreaterThan(0);
    expect(screen.getByText(/This was not settled in the interview/)).toBeTruthy();
  });

  it('gives a score to nobody', () => {
    const { container } = render(<ConsistencyComparison before={before} after={after} />);
    expect(container.textContent).not.toMatch(/\b(reject|accept|admit|score|rank)\w*/i);
  });
});

describe('the contract’s two stages', () => {
  it('keep the same item ids, so nothing is quietly dropped', () => {
    for (const itemId of before.items.map((item) => item.itemId)) {
      expect(after.items.some((item) => item.itemId === itemId), itemId).toBe(true);
    }
  });

  it('ask a question for everything left open before the interview', () => {
    for (const item of before.items) {
      if (item.status === 'discrepancy' || item.status === 'unverified') expect(item.askInInterview, item.itemId).toBeTruthy();
    }
  });
});

describe('the comparison on the API', () => {
  it('stays locked, and keeps the after stage out of the network, until the interviewer scores', async () => {
    const calls = mockApi({
      'GET /api/v1/candidates': () =>
        json(withProgress({ interviewId: 'i', transcriptStatus: 'ready', scoresSaved: false, draftReady: false }, { before: 'ready', after: 'locked' })),
      [`GET ${path}`]: () => json(wireBefore),
    });
    withQuery(<ConsistencyScreen candidateId={candidateId} />);
    expect(await screen.findByText('The interviewer has not scored yet')).toBeTruthy();
    expect(screen.getByText(/no longer scoring blind/)).toBeTruthy();
    expect(calls.some((call) => call.path.includes('stage=after'))).toBe(false);
  });

  it('shows both stages side by side once the after stage is ready', async () => {
    const calls = mockApi({
      'GET /api/v1/candidates': () =>
        json(withProgress({ interviewId: 'i', transcriptStatus: 'ready', scoresSaved: true, draftReady: true }, { before: 'ready', after: 'ready' })),
      [`GET ${path}`]: (call) => json(call.path.includes('stage=after') ? wireAfter : wireBefore),
    });
    withQuery(<ConsistencyScreen candidateId={candidateId} />);
    expect(await screen.findByText(after.items[0].observation.text)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Candidate A' })).toBeTruthy();
    expect(calls.filter((call) => call.path.startsWith(path)).map((call) => call.path.split('?')[1]).sort()).toEqual(['stage=after', 'stage=before']);
  });

  it('says the after stage is being prepared, and shows the before stage meanwhile', async () => {
    const calls = mockApi({
      'GET /api/v1/candidates': () =>
        json(withProgress({ interviewId: 'i', transcriptStatus: 'ready', scoresSaved: true, draftReady: false }, { before: 'ready', after: 'pending' })),
      [`GET ${path}`]: () => json(wireBefore),
    });
    withQuery(<ConsistencyScreen candidateId={candidateId} />);
    expect(await screen.findByText(/What the interview showed is being prepared/)).toBeTruthy();
    expect(await screen.findByText(before.items[0].observation.text)).toBeTruthy();
    expect(calls.some((call) => call.path.includes('stage=after'))).toBe(false);
  });
});
