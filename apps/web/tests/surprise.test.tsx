import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CandidateHome from '../app/(product)/candidate/page';
import { CandidateSurprise } from '../components/surprise/CandidateSurprise';
import { SurpriseScreen } from '../components/surprise/SurpriseScreen';
import type { WireCandidate } from '../lib/api/contract';
import type { SurpriseQuestion } from '../lib/surprise/types';
import { apiError, example, json, mockApi, withQuery } from './apiHarness';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }), usePathname: () => '/' }));

const created = example<SurpriseQuestion>('surprise-question.created.json');
const started = example<SurpriseQuestion>('surprise-question.started.json');
const staff = example<SurpriseQuestion>('surprise-question.staff.json');
const list = example<{ items: WireCandidate[] }>('candidates.json');
const id = created.surpriseId;
const path = `/api/v1/surprise-questions/${id}`;

class FakeRecorder {
  static isTypeSupported = () => true;
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  readonly mimeType = 'video/webm';
  constructor(readonly stream: MediaStream) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['ninety seconds'], { type: 'video/webm' }) });
    this.onstop?.();
  }
}

function withCamera() {
  const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  window.URL.createObjectURL = vi.fn(() => 'blob:answer') as unknown as typeof URL.createObjectURL;
  window.URL.revokeObjectURL = vi.fn();
}

/** The candidate's channel is sent no staff field at all. */
const inFuture = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

async function readyToOpen() {
  fireEvent.click(await screen.findByRole('button', { name: 'Check camera and microphone' }));
  await waitFor(() => expect(screen.getByText(/Nothing is being recorded yet/)).toBeTruthy());
  fireEvent.click(screen.getByLabelText(/I agree to being recorded on video/));
  fireEvent.click(screen.getByLabelText(/I agree to my answer being transcribed/));
}

beforeEach(() => push.mockReset());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the candidate answering, on the API', () => {
  it('keeps the question shut until the camera is checked and both consents are given', async () => {
    withCamera();
    mockApi({ [`GET ${path}`]: () => json(created) });
    withQuery(<SurpriseScreen surpriseId={id} />);

    const show = (await screen.findByRole('button', { name: 'Show the question' })) as HTMLButtonElement;
    expect(show.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Check camera and microphone' }));
    await waitFor(() => expect(screen.getByText(/Nothing is being recorded yet/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/I agree to being recorded on video/));
    expect(show.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/I agree to my answer being transcribed/));
    expect(show.disabled).toBe(false);
  });

  it('opens the question once, records after the reading time, and sends the video with both consents', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withCamera();
    const calls = mockApi({
      [`GET ${path}`]: () => json(created),
      [`POST ${path}/start`]: () => json({ ...started, answerDeadline: inFuture(100) }),
      [`POST ${path}/answer`]: () => json({ ...started, status: 'transcribing' }, 202),
    });
    withQuery(<SurpriseScreen surpriseId={id} />);
    await readyToOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Show the question' }));

    expect(await screen.findByText(started.question as string)).toBeTruthy();
    expect(screen.getByText(/Recording starts in/)).toBeTruthy();
    // Ten seconds to read, one tick at a time, then the camera starts by itself.
    for (let second = 0; second < 10; second += 1) await act(() => vi.advanceTimersByTimeAsync(1_000));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send my answer' }));

    expect(await screen.findByText('Your answer is in')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    const startCall = calls.find((call) => call.method === 'POST' && call.path.endsWith('/start'))!;
    expect(startCall.headers.get('Idempotency-Key')).toBeTruthy();
    const answer = calls.find((call) => call.method === 'POST' && call.path.endsWith('/answer'))!;
    const form = answer.body as FormData;
    expect(form.get('video')).toBeInstanceOf(Blob);
    expect(form.get('consentVideo')).toBe('true');
    expect(form.get('consentProcessing')).toBe('true');
    expect(answer.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('says so when the server refuses: opened elsewhere, or sent after the deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withCamera();
    mockApi({
      [`GET ${path}`]: () => json(created),
      [`POST ${path}/start`]: () => apiError(409, 'ALREADY_STARTED'),
    });
    const first = withQuery(<SurpriseScreen surpriseId={id} />);
    await readyToOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Show the question' }));
    expect(await screen.findByText('The question was already opened. There is one attempt.')).toBeTruthy();
    first.unmount();

    mockApi({
      [`GET ${path}`]: () => json({ ...started, answerDeadline: inFuture(60) }),
      [`POST ${path}/answer`]: () => apiError(409, 'DEADLINE_PASSED'),
    });
    withQuery(<SurpriseScreen surpriseId={id} />);
    await readyToOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send my answer' }));
    expect(await screen.findByText('The time for this question is over')).toBeTruthy();
  });

  it('picks an opened question up after a reload with the time that is left, never a fresh attempt', async () => {
    withCamera();
    mockApi({ [`GET ${path}`]: () => json({ ...started, answerDeadline: inFuture(42) }) });
    const resumed = withQuery(<SurpriseScreen surpriseId={id} />);
    expect(await screen.findByText(started.question as string)).toBeTruthy();
    expect(screen.getByText(/You opened this question earlier/).textContent).toMatch(/4[12]s are left/);
    expect(screen.queryByRole('button', { name: 'Show the question' })).toBeNull();
    resumed.unmount();

    mockApi({ [`GET ${path}`]: () => json({ ...started, status: 'expired' }) });
    withQuery(<SurpriseScreen surpriseId={id} />);
    expect(await screen.findByText('The time for this question is over')).toBeTruthy();
  });

  it('shows the candidate no score, nothing about a decision and nothing staff see', async () => {
    withCamera();
    mockApi({ [`GET ${path}`]: () => json({ ...started, answerDeadline: inFuture(60) }) });
    const { container } = withQuery(<SurpriseScreen surpriseId={id} />);
    await screen.findByText(started.question as string);
    expect(container.textContent).not.toMatch(/\b(score|rank|admit|reject|accept|pass|fail)\w*/i);
    expect(container.textContent).not.toContain('Disciplined Resilience');
  });
});

describe('the candidate home, step 3', () => {
  const withSurprise = (surprise: unknown) => ({
    items: list.items.map((item, index) => (index === 0 ? { ...item, progress: { ...item.progress!, surprise } } : item)),
  });

  it('writes the question on the first open, and opens the existing one after that', async () => {
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(withSurprise(null)),
      'POST /api/v1/surprise-questions': () => json(created, 201),
    });
    const first = withQuery(<CandidateHome />);
    const open = (await screen.findByRole('button', { name: 'Open the question' })) as HTMLButtonElement;
    await waitFor(() => expect(open.disabled).toBe(false));
    fireEvent.click(open);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/candidate/surprise/${id}`));
    const post = calls.find((call) => call.method === 'POST')!;
    expect(JSON.parse(post.body as string)).toEqual({ candidateId: list.items[0].candidateId });
    first.unmount();

    mockApi({ 'GET /api/v1/candidates': () => json(withSurprise({ surpriseId: id, status: 'started' })) });
    const opened = withQuery(<CandidateHome />);
    expect((await screen.findByRole('link', { name: 'Continue your answer' })).getAttribute('href')).toBe(`/candidate/surprise/${id}`);
    opened.unmount();

    mockApi({ 'GET /api/v1/candidates': () => json(withSurprise({ surpriseId: id, status: 'answered' })) });
    withQuery(<CandidateHome />);
    expect(await screen.findByText('Your answer is in')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /question|answer/i })).toBeNull();
  });
});

describe('what staff read afterwards', () => {
  it('shows the question, why it was asked and the transcript, with a source anchor for every segment', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list), [`GET ${path}`]: () => json(staff) });
    const { container } = withQuery(<CandidateSurprise candidateId={list.items[0].candidateId} />);

    expect(await screen.findByText(staff.question as string)).toBeTruthy();
    expect(screen.getByText(/D · Disciplined Resilience/)).toBeTruthy();
    expect(screen.getByText('0:03')).toBeTruthy();
    expect(screen.getByText(/two people were exhausted/)).toBeTruthy();
    expect(container.querySelector('#source-sseg_01')).not.toBeNull();
    expect(screen.getByText(/audit log/)).toBeTruthy();
  });

  it('fetches the video only when someone presses play', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list), [`GET ${path}`]: () => json({ ...staff, videoAvailable: true }) });
    const { container } = withQuery(<CandidateSurprise candidateId={list.items[0].candidateId} />);
    const play = await screen.findByRole('button', { name: 'Play the recording' });
    expect(container.querySelector('video')).toBeNull();
    fireEvent.click(play);
    const video = within(container).getByLabelText('Play the recording') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe(`${path}/video`);
  });

  it('says the video is gone once it has been deleted after the decision, and keeps the transcript', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list), [`GET ${path}`]: () => json({ ...staff, videoAvailable: false }) });
    withQuery(<CandidateSurprise candidateId={list.items[0].candidateId} />);
    expect(await screen.findByText(/deleted 30 days after the decision/)).toBeTruthy();
    expect(screen.getByText(/two people were exhausted/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play the recording' })).toBeNull();
  });

  it('shows nothing for a candidate who has no question', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list) });
    const { container } = withQuery(<CandidateSurprise candidateId={list.items[1].candidateId} />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
