import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewScreen } from '../components/interview/InterviewScreen';
import { compareScores, needsReview } from '../lib/interview/compare';
import { previewDraft, previewInterview, sampleScores } from '../lib/interview/preview';
import { DraftLockedError, IncompleteScoresError, PreviewInterviewServer } from '../lib/interview/previewServer';
import { useInterview } from '../lib/interview/useInterview';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/' }));

function Harness({ server }: { server: PreviewInterviewServer }) {
  return <InterviewScreen state={useInterview('preview', server)} />;
}

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

describe('the draft stays locked until the interviewer scores', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('answers 409 before the scores are saved, and serves the draft after', async () => {
    const server = new PreviewInterviewServer(previewDraft, 10);
    await expect(server.getDraft()).rejects.toBeInstanceOf(DraftLockedError);
    await expect(server.saveScores({ ...sampleScores, E: undefined })).rejects.toBeInstanceOf(IncompleteScoresError);

    const saving = server.saveScores(sampleScores);
    await vi.advanceTimersByTimeAsync(10);
    await saving;
    const drafting = server.getDraft();
    await vi.advanceTimersByTimeAsync(10);
    expect(await drafting).toBe(previewDraft);
  });

  it('keeps saved scores fixed', async () => {
    const server = new PreviewInterviewServer(previewDraft, 10);
    const first = server.saveScores(sampleScores);
    await vi.advanceTimersByTimeAsync(10);
    await first;
    const again = await server.saveScores({ D: 0, R: 0, I: 0, V: 0, E: 0 });
    expect(again).toEqual(sampleScores);
  });

  it('keeps the draft out of the page until the save succeeds', async () => {
    render(<Harness server={new PreviewInterviewServer(previewDraft, 10)} />);
    const rationale = previewDraft.scores.find((score) => score.competency === 'E')!.rationale!;

    expect(screen.queryByText(rationale)).toBeNull();
    expect(screen.getByText('The AI draft is locked')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save my scores' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Fill sample scores' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my scores' }));
    expect(screen.queryByText(rationale)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText(rationale)).toBeTruthy();
    expect(screen.queryByText('The AI draft is locked')).toBeNull();
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('preview interview', () => {
  it('quotes every note word for word', () => {
    const notes = new Map(previewInterview.notes.map((note) => [note.id, note.text]));
    for (const score of previewDraft.scores) {
      for (const item of score.evidence) {
        expect(item.source.kind).toBe('interview_note');
        expect(notes.get(item.source.id), item.source.id).toContain(item.quote);
      }
    }
  });
});
