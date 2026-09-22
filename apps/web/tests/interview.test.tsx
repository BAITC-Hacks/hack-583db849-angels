import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewScreen } from '../components/interview/InterviewScreen';
import { compareScores, needsReview } from '../lib/interview/compare';
import { previewDraft, previewTranscript, sampleScores } from '../lib/interview/preview';
import {
  DraftLockedError,
  IncompleteScoresError,
  PreviewInterviewServer,
  TranscriptMissingError,
} from '../lib/interview/previewServer';
import { useInterview } from '../lib/interview/useInterview';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/' }));

const server = () => new PreviewInterviewServer(previewDraft, previewTranscript, 10);

function Harness({ api }: { api: PreviewInterviewServer }) {
  return <InterviewScreen state={useInterview('preview', api)} />;
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(100);
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

describe('the preview server keeps the rules', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('answers 409 before the scores, 409 without a transcript, and the draft after both', async () => {
    const api = server();
    await expect(api.getDraft()).rejects.toBeInstanceOf(DraftLockedError);
    await expect(api.saveScores({ ...sampleScores, E: undefined })).rejects.toBeInstanceOf(IncompleteScoresError);

    const saving = api.saveScores(sampleScores);
    await vi.advanceTimersByTimeAsync(10);
    await saving;
    await expect(api.getDraft()).rejects.toBeInstanceOf(TranscriptMissingError);

    const transcribing = api.transcribe();
    await vi.advanceTimersByTimeAsync(20);
    expect(await transcribing).toBe(previewTranscript);
    const drafting = api.getDraft();
    await vi.advanceTimersByTimeAsync(10);
    expect(await drafting).toBe(previewDraft);
  });

  it('keeps saved scores fixed', async () => {
    const api = server();
    const first = api.saveScores(sampleScores);
    await vi.advanceTimersByTimeAsync(10);
    await first;
    expect(await api.saveScores({ D: 0, R: 0, I: 0, V: 0, E: 0 })).toEqual(sampleScores);
  });
});

describe('the interview screen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const rationale = previewDraft.scores.find((score) => score.competency === 'E')!.rationale!;

  it('records nothing before the candidate consents', () => {
    render(<Harness api={server()} />);
    const record = screen.getByRole('button', { name: 'Record the interview' }) as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/agreed to this interview being recorded/));
    expect(record.disabled).toBe(false);
  });

  it('says so when there is no microphone, and offers the sample', () => {
    render(<Harness api={server()} />);
    fireEvent.click(screen.getByLabelText(/agreed to this interview being recorded/));
    fireEvent.click(screen.getByRole('button', { name: 'Record the interview' }));
    expect(screen.getByText(/microphone is not available/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use the sample recording' })).toBeTruthy();
  });

  it('keeps the draft out of the page until the scores are saved', async () => {
    render(<Harness api={server()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use the sample recording' }));
    await flush();
    expect(screen.getByText(previewTranscript[1].text)).toBeTruthy();

    expect(screen.queryByText(rationale)).toBeNull();
    expect(screen.getByText('The AI draft is locked')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fill sample scores' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my scores' }));
    expect(screen.queryByText(rationale)).toBeNull();

    await flush();
    expect(screen.getByText(rationale)).toBeTruthy();
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLButtonElement).disabled).toBe(true);
  });

  it('waits for the transcript when the scores come first', async () => {
    render(<Harness api={server()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill sample scores' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my scores' }));
    await flush();
    expect(screen.getByText(/draft is written as soon as the interview transcript is ready/)).toBeTruthy();
    expect(screen.queryByText(rationale)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use the sample recording' }));
    await flush();
    await flush();
    expect(screen.getByText(rationale)).toBeTruthy();
  });
});

describe('preview interview', () => {
  it('quotes the candidate word for word from the transcript', () => {
    const turns = new Map(previewTranscript.map((turn) => [turn.turnId, turn]));
    for (const score of previewDraft.scores) {
      for (const item of score.evidence) {
        expect(item.source.kind).toBe('interview_turn');
        const turn = turns.get(item.source.id);
        expect(turn?.speaker, item.source.id).toBe('candidate');
        expect(turn!.text).toContain(item.quote);
      }
    }
  });

  it('numbers transcript turns in order with rising timecodes', () => {
    previewTranscript.forEach((turn, index) => {
      expect(turn.turnId).toBe(`iturn_${String(index + 1).padStart(2, '0')}`);
      expect(turn.endSec).toBeGreaterThan(turn.startSec);
      if (index > 0) expect(turn.startSec).toBeGreaterThanOrEqual(previewTranscript[index - 1].endSec);
    });
  });
});
