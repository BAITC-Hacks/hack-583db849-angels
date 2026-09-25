'use client';

import { useCopy } from '../../lib/i18n/StaffLocaleProvider';
import type { InterviewTurn, TranscriptStatus } from '../../lib/interview/types';
import { InterviewRecorder } from './InterviewRecorder';

const copy = {
  en: {
    title: 'Interview transcript',
    hint: 'By speaker, with timecodes. The draft quotes the candidate’s turns word for word.',
    transcribing: 'Transcribing the recording…',
    uploading: 'Sending the recording…',
    failed: 'The recording could not be transcribed. Record it again.',
    interviewer: 'Interviewer',
    candidate: 'Candidate',
  },
  ru: {
    title: 'Расшифровка интервью',
    hint: 'По говорящим, с таймкодами. Черновик дословно цитирует реплики кандидата.',
    transcribing: 'Расшифровываем запись…',
    uploading: 'Отправляем запись…',
    failed: 'Запись не удалось расшифровать. Запишите ещё раз.',
    interviewer: 'Интервьюер',
    candidate: 'Кандидат',
  },
};

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Where the interview becomes text the AI can read: record it here, or receive
 * the transcript of inVision's own recording. Every turn is an anchor that the
 * draft's quotes jump to. The words are the speakers' own and stay in English.
 */
export function InterviewTranscript({
  transcript,
  state,
  onRecorded,
  uploading = false,
  uploadError = null,
}: {
  transcript: InterviewTurn[] | null;
  state: TranscriptStatus;
  onRecorded: (audio: Blob) => void;
  uploading?: boolean;
  uploadError?: string | null;
}) {
  const text = useCopy(copy);

  return (
    <section aria-labelledby="transcript-title" className="flex max-h-[calc(100vh-3rem)] flex-col rounded-panel border border-border-subtle bg-bg-surface">
      <header className="border-b border-border-subtle px-5 py-3">
        <h2 id="transcript-title" className="text-sm font-semibold text-text-primary">
          {text.title}
        </h2>
        <p className="text-[0.75rem] text-text-muted">{text.hint}</p>
      </header>

      {state === 'failed' ? (
        <p role="alert" className="px-5 pt-4 text-sm text-status-low">
          {text.failed}
        </p>
      ) : null}
      {state === 'none' || state === 'failed' ? <InterviewRecorder onRecorded={onRecorded} disabled={uploading} /> : null}
      {uploading ? (
        <p className="px-5 pb-4 text-sm text-text-secondary" aria-live="polite">
          {text.uploading}
        </p>
      ) : null}
      {uploadError ? (
        <p role="alert" className="px-5 pb-4 text-sm text-status-low">
          {uploadError}
        </p>
      ) : null}

      {state === 'transcribing' ? (
        <p className="flex items-center gap-2 p-5 text-sm text-text-secondary" aria-live="polite">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {text.transcribing}
        </p>
      ) : null}

      {state === 'ready' && transcript ? (
        <ol className="flex flex-col gap-1 overflow-y-auto p-3" lang="en">
          {transcript.map((turn) => {
            const candidate = turn.speaker === 'candidate';
            return (
              <li
                key={turn.turnId}
                id={turn.turnId}
                className="scroll-mt-3 rounded-control px-3 py-2 transition-colors target:bg-chip-review target:ring-1 target:ring-status-evidence"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-mono text-[0.58rem] tracking-[0.12em] uppercase ${candidate ? 'text-brand-ink' : 'text-text-muted'}`}>
                    {candidate ? text.candidate : text.interviewer}
                  </span>
                  <span className="font-mono text-[0.58rem] tabular-nums text-text-muted">{clock(turn.startSec)}</span>
                </div>
                <p className={`mt-0.5 text-[0.82rem] leading-relaxed ${candidate ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {turn.text}
                </p>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
