import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CandidateHome from '../app/(product)/candidate/page';
import { CandidatePresentation } from '../components/presentation/CandidatePresentation';
import { PresentationScreen } from '../components/presentation/PresentationScreen';
import type { WireCandidate } from '../lib/api/contract';
import type { Presentation } from '../lib/presentation/types';
import { apiError, example, json, mockApi, withQuery, type Call } from './apiHarness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => '/' }));

const sent = example<Presentation>('presentation.candidate.json');
const staff = example<Presentation>('presentation.staff.json');
const list = example<{ items: WireCandidate[] }>('candidates.json');
const id = staff.presentationId;
const path = `/api/v1/presentations/${id}`;

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
    this.ondataavailable?.({ data: new Blob(['a presentation'], { type: 'video/webm' }) });
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
  window.URL.createObjectURL = vi.fn(() => 'blob:presentation') as unknown as typeof URL.createObjectURL;
  window.URL.revokeObjectURL = vi.fn();
}

function withPresentation(presentation: { presentationId: string; status: 'transcribing' | 'ready' | 'failed' } | null) {
  return { items: list.items.map((item, index) => (index === 0 ? { ...item, progress: { ...item.progress!, presentation } } : item)) };
}

const posts = (calls: Call[]) => calls.filter((call) => call.method === 'POST' && call.path === '/api/v1/presentations');

async function record(seconds: number) {
  fireEvent.click(await screen.findByRole('button', { name: 'Check camera and microphone' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Start recording' }));
  await screen.findByText(/Recording ·/);
  await act(() => vi.advanceTimersByTimeAsync(seconds * 1000));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}

function consent() {
  fireEvent.click(screen.getByLabelText(/I agree to sending this video/));
  fireEvent.click(screen.getByLabelText(/I agree to my presentation being transcribed/));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the candidate sending a presentation, on the API', () => {
  it('shows the prompt everyone gets, and will not send a recording under one minute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withCamera();
    const calls = mockApi({ 'GET /api/v1/candidates': () => json(withPresentation(null)) });
    withQuery(<PresentationScreen />);

    expect(await screen.findByText(sent.prompt)).toBeTruthy();
    await record(20);
    consent();
    expect(await screen.findByText(/needs at least one minute/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send my presentation' }) as HTMLButtonElement).disabled).toBe(true);
    expect(posts(calls)).toHaveLength(0);
  });

  it('sends a recording of a minute or more once, with both consents, and then says only that it arrived', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withCamera();
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(withPresentation(null)),
      'POST /api/v1/presentations': () => json(sent, 202),
    });
    withQuery(<PresentationScreen />);

    await record(65);
    expect(await screen.findByLabelText('Your presentation')).toBeTruthy();
    const send = screen.getByRole('button', { name: 'Send my presentation' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    consent();
    expect(send.disabled).toBe(false);
    fireEvent.click(send);

    expect(await screen.findByText('Your presentation is in')).toBeTruthy();
    const [post] = posts(calls);
    const form = post.body as FormData;
    expect(form.get('candidateId')).toBe(list.items[0].candidateId);
    expect(form.get('consentVideo')).toBe('true');
    expect(form.get('consentProcessing')).toBe('true');
    expect((form.get('video') as File).name).toBe('presentation.webm');
    expect(post.headers.get('Idempotency-Key')).toBeTruthy();
    // Nothing on the candidate's side shows a transcript, a score or a decision.
    expect(screen.queryByText(/score|transcript:/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /record|send/i })).toBeNull();
  });

  it('takes an uploaded file instead of a recording', async () => {
    withCamera();
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(withPresentation(null)),
      'POST /api/v1/presentations': () => json(sent, 202),
    });
    withQuery(<PresentationScreen />);

    const input = (await screen.findByLabelText('Upload a video', { selector: 'input' })) as HTMLInputElement;
    const file = new File(['an mp4 made on a phone'], 'my-presentation.mp4', { type: 'video/mp4' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByLabelText('Your presentation')).toBeTruthy();
    consent();
    fireEvent.click(screen.getByRole('button', { name: 'Send my presentation' }));

    expect(await screen.findByText('Your presentation is in')).toBeTruthy();
    expect(((posts(calls)[0].body as FormData).get('video') as File).name).toBe('presentation.mp4');
  });

  it('treats a second submission as the one already sent', async () => {
    withCamera();
    mockApi({
      'GET /api/v1/candidates': () => json(withPresentation(null)),
      'POST /api/v1/presentations': () => apiError(409, 'PRESENTATION_EXISTS', { presentationId: id }),
    });
    withQuery(<PresentationScreen />);

    const input = (await screen.findByLabelText('Upload a video', { selector: 'input' })) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['video'], 'a.webm', { type: 'video/webm' })] } });
    consent();
    fireEvent.click(await screen.findByRole('button', { name: 'Send my presentation' }));
    expect(await screen.findByText('Your presentation is in')).toBeTruthy();
  });

  it('opens on "sent" when the presentation is already in', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(withPresentation({ presentationId: id, status: 'transcribing' })) });
    withQuery(<PresentationScreen />);
    expect(await screen.findByText('Your presentation is in')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check camera and microphone' })).toBeNull();
  });

  it('is a step on the candidate home until it is sent', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(withPresentation(null)) });
    const before = withQuery(<CandidateHome />);
    expect((await screen.findByRole('link', { name: 'Record your presentation' })).getAttribute('href')).toBe('/candidate/presentation');
    before.unmount();

    mockApi({ 'GET /api/v1/candidates': () => json(withPresentation({ presentationId: id, status: 'ready' })) });
    withQuery(<CandidateHome />);
    expect(await screen.findByText('Your presentation is in')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Record your presentation' })).toBeNull();
  });
});

describe('what staff read', () => {
  const ready = withPresentation({ presentationId: id, status: 'ready' });

  it('shows the prompt and the transcript, with a source anchor for every segment', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(ready), [`GET ${path}`]: () => json(staff) });
    const { container } = withQuery(<CandidatePresentation candidateId={list.items[0].candidateId} />);

    expect(await screen.findByText(staff.prompt)).toBeTruthy();
    expect(screen.getByText(staff.segments![2].text)).toBeTruthy();
    for (const segment of staff.segments!) expect(container.querySelector(`#source-${segment.segmentId}`)).not.toBeNull();
    expect(screen.getByText('1:24')).toBeTruthy();
  });

  it('fetches the video only when someone presses play', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(ready), [`GET ${path}`]: () => json(staff) });
    const { container } = withQuery(<CandidatePresentation candidateId={list.items[0].candidateId} />);
    const play = await screen.findByRole('button', { name: 'Play the presentation' });
    expect(container.querySelector('video')).toBeNull();
    fireEvent.click(play);
    expect((within(container).getByLabelText('Play the presentation') as HTMLVideoElement).getAttribute('src')).toBe(`${path}/video`);
  });

  it('says the video is gone after the decision, and keeps the transcript', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(ready), [`GET ${path}`]: () => json({ ...staff, videoAvailable: false }) });
    withQuery(<CandidatePresentation candidateId={list.items[0].candidateId} />);
    expect(await screen.findByText(/deleted 30 days after the decision/)).toBeTruthy();
    expect(screen.getByText(staff.segments![0].text)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play the presentation' })).toBeNull();
  });

  it('shows nothing for a candidate who has not sent one', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(withPresentation(null)) });
    const { container } = withQuery(<CandidatePresentation candidateId={list.items[0].candidateId} />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
