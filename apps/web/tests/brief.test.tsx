import type { components } from '@invision/api-client';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BriefList } from '../components/brief/BriefList';
import { BriefScreen } from '../components/brief/BriefScreen';
import type { WireCandidate } from '../lib/api/contract';
import { toInterviewerBrief } from '../lib/api/mappers/brief';
import type { BriefEvidence, BriefFocus, InterviewerBrief } from '../lib/brief/types';
import { DemoRoleProvider } from '../lib/DemoRoleProvider';
import { competencyOrder } from '../lib/drive';
import type { DemoRole } from '../lib/roles';
import { apiError, example, json, mockApi, withQuery } from './apiHarness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/' }));

const wire = example<components['schemas']['BriefDto']>('brief.json');
const list = example<{ items: WireCandidate[] }>('candidates.json');
const brief = toInterviewerBrief(wire);
const id = wire.candidateId;
const briefPath = `/api/v1/candidates/${id}/brief`;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function withBrief(status: 'pending' | 'ready' | 'failed' | null) {
  return {
    items: list.items.map((item, index) =>
      index === 0
        ? { ...item, progress: { ...item.progress!, brief: status ? { briefId: status === 'pending' ? null : wire.briefId, status } : null } }
        : item,
    ),
  };
}

function sourceText(from: InterviewerBrief, item: BriefEvidence): string | undefined {
  if (item.source.kind === 'application_field') return from.application.find((answer) => answer.fieldId === item.source.id)?.answer;
  if (item.source.kind === 'test_item') return from.test.find((response) => response.itemId === item.source.id)?.response;
  return undefined;
}

function screenAs(role: DemoRole) {
  return withQuery(
    <DemoRoleProvider role={role}>
      <BriefScreen candidateId={id} />
    </DemoRoleProvider>,
  );
}

describe('the brief as the API sends it', () => {
  const everyEvidence = [
    ...brief.questions.flatMap((question) => question.evidence),
    ...brief.consistency.flatMap((item) => [...item.claim.evidence, ...item.observation.evidence]),
    ...brief.clarify.flatMap((topic) => topic.evidence),
  ];

  it('quotes every source word for word, and carries only the cited answers', () => {
    for (const item of everyEvidence) {
      const text = sourceText(brief, item);
      expect(text, `${item.source.kind}:${item.source.id}`).toBeDefined();
      expect(text).toContain(item.quote);
    }
    const cited = new Set(everyEvidence.map((item) => item.source.id));
    for (const answer of brief.application) expect(cited.has(answer.fieldId), answer.fieldId).toBe(true);
  });

  it('asks about all five competencies and the three topics no rubric covers', () => {
    const focuses: BriefFocus[] = [...competencyOrder, 'invision_knowledge', 'english', 'motivation'];
    const asked = new Set(brief.questions.map((question) => question.focus));
    for (const focus of focuses) expect(asked.has(focus), focus).toBe(true);
  });

  it('pairs each claim with what was measured, and turns a mismatch into a question', () => {
    expect(brief.consistency.length).toBeGreaterThan(0);
    for (const item of brief.consistency) {
      expect(item.claim.evidence.length, item.itemId).toBeGreaterThan(0);
      const observed = item.observation.evidence.length > 0 || item.observation.metric !== null;
      expect(observed || item.status === 'unverified', item.itemId).toBe(true);
      if (item.status === 'discrepancy' || item.status === 'unverified') expect(item.askInInterview, item.itemId).toBeTruthy();
    }
  });

  it('says nothing that reads as a decision or a score', () => {
    const prose = [
      brief.summary,
      ...brief.questions.flatMap((question) => [question.question, question.why]),
      ...brief.consistency.flatMap((item) => [item.claim.text, item.observation.text, item.whatToDo, item.askInInterview ?? '']),
      ...brief.clarify.map((topic) => topic.topic),
    ].join(' ');
    expect(prose).not.toMatch(/\b(reject|accept|admit|pass|fail|score|rank|recommend)\w*/i);
  });
});

describe('the brief screen on the API', () => {
  it('shows A’s brief: C2 claimed, B2 measured, and the question to ask', async () => {
    const calls = mockApi({ 'GET /api/v1/candidates': () => json(list), [`GET ${briefPath}`]: () => json(wire) });
    screenAs('interviewer');
    expect(await screen.findByRole('heading', { name: 'Candidate A' })).toBeTruthy();
    const english = screen.getByText('Rates their English as C2.').closest('article')!;
    expect(within(english).getByText(/cefrEstimate: B2/)).toBeTruthy();
    expect(within(english).getByText(/In English and without preparing/)).toBeTruthy();
    expect(calls.some((call) => call.method === 'GET' && call.path === briefPath)).toBe(true);
    // The side panel holds exactly the cited answers, and the surprise block waits for #55.
    expect(document.querySelectorAll('[id^="source-"]')).toHaveLength(wire.sources.application.length + wire.sources.test.length);
    expect(screen.queryByText('Surprise answer')).toBeNull();
  });

  it('says it is being prepared, and opens the brief by itself once it is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let ready = false;
    mockApi({
      'GET /api/v1/candidates': () => json(withBrief(ready ? 'ready' : 'pending')),
      [`GET ${briefPath}`]: () => (ready ? json(wire) : apiError(404, 'BRIEF_NOT_FOUND')),
    });
    screenAs('interviewer');
    expect(await screen.findByText('The brief is being prepared')).toBeTruthy();

    ready = true;
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(await screen.findByRole('heading', { name: 'Candidate A' })).toBeTruthy();
  });

  it('lets only the admin make a failed brief again, and a retry keeps its Idempotency-Key', async () => {
    const briefNotFound = () => apiError(404, 'BRIEF_NOT_FOUND');
    mockApi({ 'GET /api/v1/candidates': () => json(withBrief('failed')), [`GET ${briefPath}`]: briefNotFound });
    const interviewer = screenAs('interviewer');
    expect(await screen.findByText('The brief could not be made')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Make the brief again' })).toBeNull();
    interviewer.unmount();

    let attempt = 0;
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(withBrief('failed')),
      [`GET ${briefPath}`]: briefNotFound,
      'POST /api/v1/briefs': () => ((attempt += 1) === 1 ? apiError(503, 'AI_UNAVAILABLE') : json(wire, 201)),
    });
    screenAs('admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Make the brief again' }));
    expect(await screen.findByText('The AI service is not answering. Try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Candidate A' })).toBeTruthy();

    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(JSON.parse(posts[0].body as string)).toEqual({ candidateId: id });
    expect(posts[0].headers.get('Idempotency-Key')).toBeTruthy();
    expect(posts[1].headers.get('Idempotency-Key')).toBe(posts[0].headers.get('Idempotency-Key'));
  });

  it('tells a role that may not read it apart from a brief that is not there yet', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(withBrief(null)), [`GET ${briefPath}`]: () => apiError(403, 'FORBIDDEN') });
    const forbidden = screenAs('interviewer');
    expect(await screen.findByText('This role does not see the brief.')).toBeTruthy();
    forbidden.unmount();

    mockApi({ 'GET /api/v1/candidates': () => json(withBrief(null)), [`GET ${briefPath}`]: () => apiError(404, 'BRIEF_NOT_FOUND') });
    screenAs('interviewer');
    expect(await screen.findByText('There is no brief for this candidate yet')).toBeTruthy();
  });
});

describe('the briefs list', () => {
  it('shows where each brief is and links to it by the API’s own id', async () => {
    const items = withBrief('pending').items;
    mockApi({ 'GET /api/v1/candidates': () => json({ items }) });
    withQuery(<BriefList />);
    const rowA = (await screen.findByText('Candidate A')).closest('li')!;
    expect(within(rowA).getByText('Being prepared')).toBeTruthy();
    expect(within(rowA).getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(`/interviewer/brief/${id}`);
    const rowB = screen.getByText('Candidate B').closest('li')!;
    expect(within(rowB).getByText('Ready')).toBeTruthy();
  });
});
