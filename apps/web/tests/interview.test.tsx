import type { components } from '@invision/api-client';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewList } from '../components/interview/InterviewList';
import { InterviewLoader } from '../components/interview/InterviewLoader';
import type { WireCandidate } from '../lib/api/contract';
import { toAssessmentDraft, toInterviewRecord } from '../lib/api/mappers/interview';
import { DemoRoleProvider } from '../lib/DemoRoleProvider';
import { compareScores, needsReview } from '../lib/interview/compare';
import { DEMO_INTERVIEWER_REF } from '../lib/interview/queries';
import { apiError, example, json, mockApi, withQuery, type Call } from './apiHarness';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }), usePathname: () => '/' }));

type WireInterview = components['schemas']['InterviewDto'];
type WireDraft = components['schemas']['AssessmentDraftDto'];
const wire = example<WireInterview>('interview.json');
const wireDraft = example<WireDraft>('assessment-draft.json');
const id = wire.interviewId;
const path = `/api/v1/interviews/${id}`;
const draft = toAssessmentDraft(wireDraft);
const rationale = draft.scores.find((score) => score.competency === 'E')!.rationale!;

/**
 * A fake of the interview routes that keeps the server's rules: the draft is
 * locked until the scores, missing until the transcript, and a recording
 * answers `transcribing` before the next read finds it ready.
 */
function interviewServer(start: 'none' | 'ready') {
  const state = { status: start as string, scores: null as Record<string, number | null> | null };
  const calls = mockApi({
    [`GET ${path}`]: () => {
      // The first read after an upload finds the transcription done.
      if (state.status === 'transcribing') state.status = 'ready';
      return json({ ...wire, transcriptStatus: state.status, transcript: state.status === 'ready' ? wire.transcript : null, interviewerScores: state.scores });
    },
    [`POST ${path}/recording`]: () => {
      state.status = 'transcribing';
      return json({ ...wire, transcriptStatus: 'transcribing', transcript: null }, 202);
    },
    [`POST ${path}/interviewer-scores`]: (call: Call) => {
      state.scores = JSON.parse(call.body as string).scores;
      return json({ interviewId: id, scores: state.scores, savedAt: '2026-09-26T10:40:00Z' }, 201);
    },
    [`GET ${path}/assessment-draft`]: () =>
      !state.scores ? apiError(409, 'DRAFT_LOCKED') : state.status !== 'ready' ? apiError(404, 'DRAFT_NOT_FOUND') : json(wireDraft),
  });
  return { calls, state };
}

function scoreEverything() {
  for (const group of screen.getAllByRole('radiogroup')) {
    const label = group.getAttribute('aria-label') ?? '';
    fireEvent.click(within(group).getByRole('radio', { name: label.startsWith('Values') ? 'Not enough to judge' : '3' }));
  }
}

const draftCalls = (calls: Call[]) => calls.filter((call) => call.path.endsWith('/assessment-draft'));

beforeEach(() => push.mockReset());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('comparison', () => {
  it('describes differences without resolving them', () => {
    expect(compareScores(3, 3)).toBe('agree');
    expect(compareScores(3, 4)).toBe('close');
    expect(compareScores(1, 4)).toBe('discuss');
    expect(compareScores(null, 2)).toBe('draft-found');
    expect(compareScores(2, null)).toBe('draft-none');
    expect(compareScores(null, null)).toBe('both-none');
    expect(needsReview('close')).toBe(false);
    expect(needsReview('discuss')).toBe(true);
  });
});

describe('the interview screen on the API', () => {
  it('records nothing before the candidate consents, and says so when there is no microphone', async () => {
    interviewServer('none');
    withQuery(<InterviewLoader interviewId={id} />);
    const record = (await screen.findByRole('button', { name: 'Record the interview' })) as HTMLButtonElement;
    const demo = screen.getByRole('button', { name: 'Use the demo recording' }) as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    expect(demo.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/agreed to this interview being recorded/));
    expect(record.disabled).toBe(false);
    fireEvent.click(record);
    expect(await screen.findByText(/microphone is not available/)).toBeTruthy();
  });

  it('keeps the draft out of the page and out of the network until the scores are saved', async () => {
    const { calls } = interviewServer('ready');
    withQuery(<InterviewLoader interviewId={id} />);
    expect(await screen.findByText(wire.transcript![1].text)).toBeTruthy();
    expect(screen.getByText('The AI draft is locked')).toBeTruthy();

    scoreEverything();
    expect(draftCalls(calls)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save my scores' }));

    expect(await screen.findByText(rationale)).toBeTruthy();
    const save = calls.find((call) => call.method === 'POST' && call.path.endsWith('/interviewer-scores'))!;
    expect(JSON.parse(save.body as string)).toEqual({ scores: { D: 3, R: 3, I: 3, V: null, E: 3 } });
    expect(save.headers.get('Idempotency-Key')).toBeTruthy();
    // Every draft request came after the save.
    expect(calls.indexOf(draftCalls(calls)[0])).toBeGreaterThan(calls.indexOf(save));
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends the recording with the consent, and shows the transcript once it is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { calls } = interviewServer('none');
    withQuery(<InterviewLoader interviewId={id} />);
    fireEvent.click(await screen.findByLabelText(/agreed to this interview being recorded/));
    fireEvent.click(screen.getByRole('button', { name: 'Use the demo recording' }));

    expect(await screen.findByText('Transcribing the recording…')).toBeTruthy();
    const upload = calls.find((call) => call.path.endsWith('/recording'))!;
    const form = upload.body as FormData;
    expect(form.get('consent')).toBe('true');
    expect((form.get('audio') as Blob).type).toBe('audio/wav');

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(await screen.findByText(wire.transcript![1].text)).toBeTruthy();
  });

  it('waits for the transcript when the scores come first, then shows the draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    interviewServer('none');
    withQuery(<InterviewLoader interviewId={id} />);
    await screen.findByRole('button', { name: 'Save my scores' });
    scoreEverything();
    fireEvent.click(screen.getByRole('button', { name: 'Save my scores' }));
    expect(await screen.findByText(/draft is written as soon as the interview transcript is ready/)).toBeTruthy();
    expect(screen.queryByText(rationale)).toBeNull();

    fireEvent.click(screen.getByLabelText(/agreed to this interview being recorded/));
    fireEvent.click(screen.getByRole('button', { name: 'Use the demo recording' }));
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(await screen.findByText(rationale)).toBeTruthy();
  });

  it('says why when the server refuses to take a second set of scores', async () => {
    interviewServer('ready');
    mockApi({
      [`GET ${path}`]: () => json({ ...wire, interviewerScores: null }),
      [`POST ${path}/interviewer-scores`]: () => apiError(409, 'SCORES_ALREADY_SAVED'),
    });
    withQuery(<InterviewLoader interviewId={id} />);
    await screen.findByRole('button', { name: 'Save my scores' });
    scoreEverything();
    fireEvent.click(screen.getByRole('button', { name: 'Save my scores' }));
    expect(await screen.findByText('The scores are already saved. Reload to see them.')).toBeTruthy();
  });
});

describe('the interviews list', () => {
  const list = example<{ items: WireCandidate[] }>('candidates.json');
  const noInterview = { items: list.items.map((item) => ({ ...item, progress: { ...item.progress!, interview: null } })) };

  it('starts an interview as the demo’s interviewer and opens it', async () => {
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(noInterview),
      'POST /api/v1/interviews': () => json({ ...wire, transcriptStatus: 'none', transcript: null }, 201),
    });
    withQuery(
      <DemoRoleProvider role="interviewer">
        <InterviewList />
      </DemoRoleProvider>,
    );
    const rowA = (await screen.findByText('Candidate A')).closest('li')!;
    fireEvent.click(within(rowA).getByRole('button', { name: 'Start the interview' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/interviewer/interview/${id}`));
    const post = calls.find((call) => call.method === 'POST')!;
    expect(JSON.parse(post.body as string)).toMatchObject({ candidateId: list.items[0].candidateId, interviewerRef: DEMO_INTERVIEWER_REF });
  });

  it('lets the commission look but not start one', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(noInterview) });
    withQuery(
      <DemoRoleProvider role="commission">
        <InterviewList />
      </DemoRoleProvider>,
    );
    await screen.findByText('Candidate A');
    expect(screen.queryByRole('button', { name: 'Start the interview' })).toBeNull();
  });
});

describe('the contract’s interview', () => {
  const record = toInterviewRecord(wire);

  it('quotes the candidate word for word from the transcript', () => {
    const turns = new Map(record.transcript.map((turn) => [turn.turnId, turn]));
    for (const score of draft.scores) {
      for (const item of score.evidence) {
        expect(item.source.kind).toBe('interview_turn');
        const turn = turns.get(item.source.id);
        expect(turn?.speaker, item.source.id).toBe('candidate');
        expect(turn!.text).toContain(item.quote);
      }
    }
  });

  it('numbers transcript turns in order with rising timecodes', () => {
    record.transcript.forEach((turn, index) => {
      expect(turn.turnId).toBe(`iturn_${String(index + 1).padStart(2, '0')}`);
      expect(turn.endSec).toBeGreaterThan(turn.startSec);
      if (index > 0) expect(turn.startSec).toBeGreaterThanOrEqual(record.transcript[index - 1].endSec);
    });
  });

  it('comes back with no scores until the interviewer saves them', () => {
    expect(record.savedScores).toBeNull();
    expect(record.view).toMatchObject({ interviewId: id, candidate: { code: 'A' } });
  });
});
