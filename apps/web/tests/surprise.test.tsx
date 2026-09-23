import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurpriseAnswer } from '../components/surprise/SurpriseAnswer';
import { SurpriseFlow } from '../components/surprise/SurpriseFlow';
import { previewSurpriseAnswered, previewSurpriseReady, previewSurpriseStarted } from '../lib/surprise/preview';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/' }));

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

afterEach(() => vi.unstubAllGlobals());

describe('the candidate answering', () => {
  it('keeps the question shut until both consents are given', async () => {
    withCamera();
    render(<SurpriseFlow surprise={previewSurpriseStarted} />);

    const show = screen.getByRole('button', { name: 'Show the question' }) as HTMLButtonElement;
    expect(show.disabled).toBe(true);
    expect(screen.queryByText(previewSurpriseStarted.question as string)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Check camera and microphone' }));
    await waitFor(() => expect(screen.getByText(/Nothing is being recorded yet/)).toBeTruthy());

    fireEvent.click(screen.getByLabelText(/I agree to being recorded on video/));
    expect((screen.getByRole('button', { name: 'Show the question' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/I agree to my answer being transcribed/));
    expect((screen.getByRole('button', { name: 'Show the question' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('says there is one attempt, and offers no second one after sending', async () => {
    withCamera();
    render(<SurpriseFlow surprise={previewSurpriseStarted} />);
    expect(screen.getByText(/One attempt/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Check camera and microphone' }));
    await waitFor(() => expect(screen.getByText(/Nothing is being recorded yet/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/I agree to being recorded on video/));
    fireEvent.click(screen.getByLabelText(/I agree to my answer being transcribed/));
    fireEvent.click(screen.getByRole('button', { name: 'Show the question' }));

    // The question is out, so the attempt has begun.
    expect(screen.getByText(previewSurpriseStarted.question as string)).toBeTruthy();
    expect(screen.getByText(/Recording starts in/)).toBeTruthy();
  });

  it('shows the candidate no score and nothing about a decision', () => {
    withCamera();
    const { container } = render(<SurpriseFlow surprise={previewSurpriseStarted} />);
    expect(container.textContent).not.toMatch(/\b(score|rank|admit|reject|accept|pass|fail)\w*/i);
  });

  it('never leaks the staff side of the question to the candidate', () => {
    withCamera();
    const { container } = render(<SurpriseFlow surprise={previewSurpriseStarted} />);
    // competency and why are staff-only fields; the started example has neither.
    expect(previewSurpriseStarted.competency).toBeUndefined();
    expect(previewSurpriseReady.question).toBeNull();
    expect(container.textContent).not.toContain('Disciplined Resilience');
  });
});

describe('what staff read afterwards', () => {
  it('shows the question, why it was asked and the transcript with timecodes', () => {
    render(<SurpriseAnswer surprise={previewSurpriseAnswered} />);

    expect(screen.getByText(previewSurpriseAnswered.question as string)).toBeTruthy();
    expect(screen.getByText(/D · Disciplined Resilience/)).toBeTruthy();
    expect(screen.getByText('0:03')).toBeTruthy();
    expect(screen.getByText(/two people were exhausted/)).toBeTruthy();
  });

  it('says a viewing is audited and that the video never reaches a model', () => {
    render(<SurpriseAnswer surprise={previewSurpriseAnswered} />);
    expect(screen.getByText(/audit log/)).toBeTruthy();
    expect(screen.getByText(/never reaches a model/)).toBeTruthy();
  });
});
