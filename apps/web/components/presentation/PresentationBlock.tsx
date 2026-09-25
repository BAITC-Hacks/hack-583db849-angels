'use client';

import { PlayCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { Presentation } from '../../lib/presentation/types';

const copy = {
  en: {
    title: 'Video presentation',
    note: 'One to three minutes in English, recorded or uploaded by the candidate and sent once.',
    transcript: 'What they said',
    video: 'Play the presentation',
    videoNote: 'Every viewing is written to the audit log. The video never reaches a model — only this transcript does.',
    transcribing: 'The presentation is being transcribed.',
    failed: 'The presentation could not be transcribed. The video is kept.',
    silent: 'No speech was recognised in the presentation.',
    videoGone: 'The video is no longer kept: it is deleted 30 days after the decision. The transcript stays.',
    length: 'Length',
  },
  ru: {
    title: 'Видеопрезентация',
    note: 'От одной до трёх минут на английском. Кандидат записал или загрузил её и отправил один раз.',
    transcript: 'Что кандидат сказал',
    video: 'Посмотреть презентацию',
    videoNote: 'Каждый просмотр пишется в журнал. Видео не попадает в модель — туда идёт только эта расшифровка.',
    transcribing: 'Презентация расшифровывается.',
    failed: 'Презентацию не удалось расшифровать. Видео сохранено.',
    silent: 'В презентации не распознано речи.',
    videoGone: 'Видео больше не хранится: оно удаляется через 30 дней после решения. Расшифровка остаётся.',
    length: 'Длина',
  },
};

function timecode(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * What staff see of the video presentation: the prompt, and the transcript
 * with timecodes, so a quote in the brief (`#source-pseg_NN`) lands on the
 * moment it came from. The video sits behind a button that writes an audit line.
 */
export function PresentationBlock({ presentation, videoUrl }: { presentation: Presentation; videoUrl?: string | null }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const segments = presentation.segments ?? [];
  const [playing, setPlaying] = useState(false);
  const status = presentation.status === 'transcribing' ? text.transcribing : presentation.status === 'failed' ? text.failed : text.silent;

  return (
    <section aria-labelledby="presentation-title" className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 id="presentation-title" className="text-sm font-semibold text-text-primary">
          {text.title}
        </h2>
        <p className="text-[0.75rem] text-text-muted">
          {text.note} {text.length}: <span className="font-mono tabular-nums">{timecode(presentation.durationSec)}</span>
        </p>
      </div>

      <p lang="en" className="rounded-control border-l-2 border-brand-green bg-bg-elevated px-3 py-2 text-sm text-text-primary">
        {presentation.prompt}
      </p>

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

      {presentation.videoAvailable && videoUrl ? (
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
      ) : presentation.status === 'ready' && presentation.videoAvailable === false ? (
        <p className="text-[0.72rem] text-text-muted">{text.videoGone}</p>
      ) : null}
    </section>
  );
}
