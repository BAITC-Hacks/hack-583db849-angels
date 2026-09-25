import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminHome from '../app/(product)/admin/page';
import { DemoOverview } from '../components/demo/DemoOverview';
import type { WireCandidate } from '../lib/api/contract';
import { example, json, mockApi, withQuery } from './apiHarness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => '/' }));

const overview = example<Record<string, unknown>>('admin-overview.json');
const audit = example<{ items: unknown[] }>('audit-events.json');
const list = example<{ items: WireCandidate[] }>('candidates.json');
/** B and C have not played: the recorded session is offered for them. */
const unplayed = { items: list.items.map((item, index) => (index === 0 ? item : { ...item, progress: { ...item.progress!, simulation: null } })) };

afterEach(() => vi.unstubAllGlobals());

describe('the admin’s home on the API', () => {
  it('shows the gateway, the budget and the audit log in words', async () => {
    mockApi({
      'GET /api/v1/admin/overview': () => json(overview),
      'GET /api/v1/audit-events': () => json(audit),
      'GET /api/v1/candidates': () => json(unplayed),
    });
    withQuery(<AdminHome />);
    expect(await screen.findByText('$0.00 / $20')).toBeTruthy();
    expect(screen.getByText('replay')).toBeTruthy();
    expect(screen.getByText('14 replayed')).toBeTruthy();
    expect(await screen.findByText('AI draft written')).toBeTruthy();
    expect(screen.getAllByText(/Candidate A/).length).toBeGreaterThan(0);
  });

  it('resets the demo after a confirmation, and finishes a simulation from the recording', async () => {
    const calls = mockApi({
      'GET /api/v1/admin/overview': () => json(overview),
      'GET /api/v1/audit-events': () => json({ items: [] }),
      'GET /api/v1/candidates': () => json(unplayed),
      'POST /api/v1/demo/reset': () => new Response(null, { status: 204 }),
      'POST /api/v1/demo/recorded-session': () => json(list.items[1].progress, 200),
    });
    withQuery(<AdminHome />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reset the demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/demo/reset')).toBe(true));

    fireEvent.click(await screen.findByRole('button', { name: 'Finish Candidate B’s simulation from the recording' }));
    await waitFor(() => expect(calls.some((call) => call.path === '/api/v1/demo/recorded-session')).toBe(true));
    const post = calls.find((call) => call.path === '/api/v1/demo/recorded-session')!;
    expect(JSON.parse(post.body as string)).toEqual({ candidateId: list.items[1].candidateId });
    expect(screen.queryByRole('button', { name: /Candidate A’s simulation/ })).toBeNull();
  });

  it('says the controls are off without DEMO_MODE', async () => {
    mockApi({
      'GET /api/v1/admin/overview': () => json({ ...overview, demoMode: false }),
      'GET /api/v1/audit-events': () => json({ items: [] }),
      'GET /api/v1/candidates': () => json(list),
    });
    withQuery(<AdminHome />);
    expect(await screen.findByText('The demo controls work only with DEMO_MODE=true.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset the demo' })).toBeNull();
  });
});

describe('the demo overview', () => {
  it('starts each candidate’s path by their own id from the API', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list) });
    withQuery(<DemoOverview />);
    const links = await screen.findAllByRole('link', { name: /Start: Brief/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(list.items.map((item) => `/interviewer/brief/${item.candidateId}`));
  });
});
