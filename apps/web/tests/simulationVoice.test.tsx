import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer } from '../components/simulation/Composer';
import { VoiceComposer } from '../components/simulation/VoiceComposer';
import { getWorld, record, resetWorld, setTextMode } from '../lib/demo/world';

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

describe('the accommodation', () => {
  it('switches a candidate to typing, with the reason, and says who changed it', () => {
    expect(setTextMode('A', true, 'No microphone available')).toBe(true);
    expect(getWorld().accommodations.A).toEqual({ textMode: true, reason: 'No microphone available' });
    expect(getWorld().events[0].code).toBe('accommodation-changed');
  });

  it('cannot be changed once the simulation has started', () => {
    record('simulation-started', 'A', { simulation: 'in-progress' });
    expect(setTextMode('A', true, 'Too late')).toBe(false);
    expect(getWorld().accommodations.A.textMode).toBe(false);
  });
});
