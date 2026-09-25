'use client';

import { PlayCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { competencies } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { SurpriseAnswerView } from '../../lib/surprise/types';

const copy = {
  en: {
    title: 'Surprise answer',
    note: 'One question about their own application, ninety seconds on camera, one attempt.',
    asks: 'What it asks about',
    why: 'Why this question',
    transcript: 'What they said',
    video: 'Play the recording',
    videoNote: 'Every viewing is written to the audit log. The video never reaches a model — only this transcript does.',
    waiting: 'The answer has not been recorded yet.',
    transcribing: 'The answer is being transcribed.',
    failed: 'The answer could not be transcribed. The video is kept.',
    expired: 'The question was opened and not answered in time.',
    silent: 'No speech was recognised in the answer.',
  },
  ru: {
    title: 'Сюрпризный ответ',
    note: 'Один вопрос по собственной анкете, девяносто секунд на камеру, одна попытка.',
    asks: 'О чём вопрос',
    why: 'Почему именно он',
    transcript: 'Что кандидат сказал',
    video: 'Посмотреть запись',
    videoNote: 'Каждый просмотр пишется в журнал. Видео не попадает в модель — туда идёт только эта расшифровка.',
    waiting: 'Ответ ещё не записан.',
    transcribing: 'Ответ расшифровывается.',
    failed: 'Ответ не удалось расшифровать. Видео сохранено.',
    expired: 'Вопрос открыли, но не ответили вовремя.',
    silent: 'В ответе не распознано речи.',
  },
};

function timecode(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * What staff see of the surprise answer: the question, why it was asked, and
 * the transcript with timecodes, so a quote in the brief can be checked
 * against the moment it came from. The recording itself sits behind a button
 * that writes an audit line.
 */
export function SurpriseAnswer({ surprise, videoUrl }: { surprise: SurpriseAnswerView; videoUrl?: string | null }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const segments = surprise.segments ?? [];
  const [playing, setPlaying] = useState(false);
  const status =
    surprise.status === 'transcribing'
      ? text.transcribing
      : surprise.status === 'failed'
        ? text.failed
        : surprise.status === 'expired'
          ? text.expired
          : surprise.status === 'answered'
            ? text.silent
            : text.waiting;

  return (
    <section aria-labelledby="surprise-title" className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 id="surprise-title" className="text-sm font-semibold text-text-primary">
          {text.title}
        </h2>
        <p className="text-[0.75rem] text-text-muted">{text.note}</p>
      </div>

      <p className="rounded-control border-l-2 border-brand-green bg-bg-elevated px-3 py-2 text-sm text-text-primary">
        {surprise.question}
      </p>

      {surprise.competency ? (
        <p className="text-[0.8rem] text-text-secondary">
          <span className="font-semibold text-text-primary">{text.asks}:</span> {surprise.competency} ·{' '}
          {competencies[surprise.competency].name}
          {surprise.why ? ` — ${surprise.why}` : ''}
        </p>
      ) : null}

      {segments.length > 0 ? (
        <>
          <p className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{text.transcript}</p>
          <ol className="flex flex-col gap-2">
            {segments.map((segment) => (
              <li key={segment.segmentId} id={`source-${segment.segmentId}`} className="flex scroll-mt-6 gap-3 border-l-2 border-status-evidence pl-3">
                <span className="font-mono text-[0.62rem] tabular-nums text-status-evidence">{timecode(segment.startSec)}</span>
                <span lang="en" className="text-sm text-text-primary">
                  {segment.text}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="text-sm text-text-secondary">{status}</p>
      )}

      {surprise.videoAvailable && videoUrl ? (
        <div className="flex flex-col gap-1.5">
          {/* The video is fetched only on this click, so each view is one audit line on the server. */}
          {playing ? (
            <video controls autoPlay src={videoUrl} className="w-full rounded-control bg-bg-elevated" aria-label={text.video} />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="inline-flex w-fit items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated"
            >
              <PlayCircleIcon aria-hidden="true" className="h-4 w-4" />
              {text.video}
            </button>
          )}
          <p className="text-[0.72rem] text-text-muted">{text.videoNote}</p>
        </div>
      ) : null}
    </section>
  );
}
