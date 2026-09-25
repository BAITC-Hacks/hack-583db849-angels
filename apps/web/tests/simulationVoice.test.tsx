import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer } from '../components/simulation/Composer';
import { VoiceComposer } from '../components/simulation/VoiceComposer';
import { AccommodationControl } from '../components/home/AccommodationControl';
import type { WireCandidate } from '../lib/api/contract';
import { getWorld, resetWorld } from '../lib/demo/world';
import { apiError, example, json, mockApi, withQuery } from './apiHarness';

/**
 * The simulation is spoken. These tests hold the two rules that make it worth
 * anything: a prepared answer cannot be pasted in, and typing exists only when
 * staff switched it on for a candidate.
 */
class FakeRecorder {
  static isTypeSupported = () => true;
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  readonly mimeType = 'audio/webm';

  constructor(readonly stream: MediaStream) {}

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['spoken words'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function withMicrophone(granted: boolean) {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(granted ? async () => stream : async () => Promise.reject(new Error('denied'))) },
  });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  // jsdom has no object URLs, and the component plays the clip back from one.
  window.URL.createObjectURL = vi.fn(() => 'blob:recording') as unknown as typeof URL.createObjectURL;
  window.URL.revokeObjectURL = vi.fn();
}

beforeEach(() => resetWorld());
afterEach(() => vi.unstubAllGlobals());

describe('taking a turn by voice', () => {
  it('offers a microphone and no way to type', () => {
    withMicrophone(true);
    render(<VoiceComposer disabled={false} waiting={false} onSend={() => true} />);

    expect(screen.getByText('Hold to speak')).toBeTruthy();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('records while held, then sends what was said', async () => {
    withMicrophone(true);
    const onSend = vi.fn<(clip: Blob) => boolean>(() => true);
    render(<VoiceComposer disabled={false} waiting={false} onSend={onSend} />);

    const button = screen.getByRole('button');
    fireEvent.pointerDown(button, { pointerId: 1 });
    await waitFor(() => expect(screen.getByText(/Listening/)).toBeTruthy());

    fireEvent.pointerUp(button, { pointerId: 1 });
    const send = await screen.findByText('Send this turn');

    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it('explains the accommodation when the microphone is refused', async () => {
    withMicrophone(false);
    render(<VoiceComposer disabled={false} waiting={false} onSend={() => true} />);

    fireEvent.pointerDown(screen.getByRole('button'), { pointerId: 1 });
    expect(await screen.findByText('The microphone is not available')).toBeTruthy();
    expect(screen.getByText(/switch typing on/)).toBeTruthy();
  });
});

describe('typing a turn, when it is allowed at all', () => {
  it('refuses a paste', () => {
    render(<Composer disabled={false} waiting={false} onSend={() => true} />);
    const field = screen.getByLabelText('Your reply');

    const paste = new Event('paste', { bubbles: true, cancelable: true });
    fireEvent(field, paste);
    expect(paste.defaultPrevented).toBe(true);
  });
});

describe('the accommodation, on the API', () => {
  const list = example<{ items: WireCandidate[] }>('candidates.json');
  const notStarted = {
    items: list.items.map((item) => ({ ...item, progress: { ...item.progress!, simulation: null } })),
  };
  const saved = (textMode: boolean, reason: string) =>
    json({ candidateId: list.items[0].candidateId, textMode, reason, setByRole: 'commission', setAt: '2026-09-25T09:00:00Z' });

  it('switches a candidate to typing, with the reason, and keeps what the server answered', async () => {
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(notStarted),
      'PUT /api/v1/candidates/[^/]+/accommodations': () => saved(true, 'No microphone available'),
    });
    withQuery(<AccommodationControl />);
    const [field] = await screen.findAllByPlaceholderText('No microphone available');
    await waitFor(() => expect((field as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(field, { target: { value: 'No microphone available' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch typing on' })[0]);

    await waitFor(() => expect(getWorld().accommodations.A).toEqual({ textMode: true, reason: 'No microphone available' }));
    const put = calls.find((call) => call.method === 'PUT')!;
    expect(put.path).toBe(`/api/v1/candidates/${list.items[0].candidateId}/accommodations`);
    expect(JSON.parse(put.body as string)).toEqual({ textMode: true, reason: 'No microphone available' });
  });

  it('cannot be changed once the simulation has started', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list) });
    withQuery(<AccommodationControl />);
    expect((await screen.findAllByText(/can no longer be changed/)).length).toBeGreaterThan(0);
    expect((screen.getAllByRole('button', { name: 'Switch typing on' })[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('says so when the server refuses', async () => {
    mockApi({
      'GET /api/v1/candidates': () => json(notStarted),
      'PUT /api/v1/candidates/[^/]+/accommodations': () => apiError(409, 'SIMULATION_STARTED'),
    });
    withQuery(<AccommodationControl />);
    const [field] = await screen.findAllByPlaceholderText('No microphone available');
    await waitFor(() => expect((field as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(field, { target: { value: 'Too late' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch typing on' })[0]);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(getWorld().accommodations.A.textMode).toBe(false);
  });
});
