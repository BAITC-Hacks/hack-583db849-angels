'use client';

import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CallRoom } from '../../lib/call/useCallRoom';
import { useCallRecording } from '../../lib/call/useCallRecording';
import { errorText } from '../../lib/api/errors';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { useUploadRecording } from '../../lib/interview/queries';

const copy = {
  en: {
    title: 'Recording',
    waitingAnswer: 'The candidate answers the recording question when they join.',
    declined: 'The candidate did not agree to recording. Nothing is recorded — take notes instead.',
    agreed: 'The candidate agreed to the call being recorded as audio and transcribed. The video is never recorded.',
    start: 'Start recording',
    stop: 'Stop and transcribe',
    recording: 'Recording both voices',
    unsupported: 'This browser cannot record here.',
    withdrawn: 'The candidate withdrew consent, so the recording was thrown away.',
    sent: 'Sent for transcription. The transcript, and after your scores the draft, are on the interview page.',
    open: 'Open the interview page',
    retry: 'Try again',
  },
  ru: {
    title: 'Запись',
    waitingAnswer: 'Кандидат ответит про запись, когда войдёт в звонок.',
    declined: 'Кандидат не согласился на запись. Ничего не записывается — ведите заметки.',
    agreed: 'Кандидат согласился на запись звонка как аудио и на расшифровку. Видео не записывается.',
    start: 'Начать запись',
    stop: 'Остановить и расшифровать',
    recording: 'Записываем оба голоса',
    unsupported: 'Этот браузер не умеет записывать.',
    withdrawn: 'Кандидат отозвал согласие, поэтому запись удалена.',
    sent: 'Отправлено на расшифровку. Расшифровка, а после ваших баллов и черновик — на странице интервью.',
    open: 'Открыть страницу интервью',
    retry: 'Повторить',
  },
};

/**
 * Audio of the call, both voices, only while the candidate's consent stands.
 * If they withdraw it by rejoining with "no", the recording is thrown away,
 * not sent. What is sent goes into the ordinary interview pipeline.
 */
export function CallRecordingPanel({
  room,
  interviewId,
  candidateJoined,
  consent,
}: {
  room: CallRoom;
  interviewId: string;
  candidateJoined: boolean;
  consent: boolean;
}) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const recorder = useCallRecording();
  const upload = useUploadRecording(interviewId);
  const [notice, setNotice] = useState<'unsupported' | 'withdrawn' | null>(null);
  // Kept until the upload succeeds, so a failed one can be sent again rather than lost.
  const [unsent, setUnsent] = useState<Blob | null>(null);
  const { recording, discard, add } = recorder;

  // Consent withdrawn mid-recording: nothing recorded so far is kept.
  useEffect(() => {
    if (recording && !consent) {
      discard();
      queueMicrotask(() => setNotice('withdrawn'));
    }
  }, [consent, discard, recording]);

  // Leaving the call ends the recording and sends it, rather than dropping it.
  const callOver = room.state === 'ended' || room.state === 'failed';
  useEffect(() => {
    if (recording && callOver) void stop();
    // `stop` is this render's; the effect only needs to run when the call ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callOver, recording]);

  // The candidate reconnected: their new voice joins the same recording.
  useEffect(() => {
    if (recording && room.otherAudio?.mediaStreamTrack) add(room.otherAudio.mediaStreamTrack);
  }, [add, recording, room.otherAudio]);

  function start() {
    const voices = [room.localAudio?.mediaStreamTrack, room.otherAudio?.mediaStreamTrack].filter((track): track is MediaStreamTrack => Boolean(track));
    setNotice(recorder.start(voices) ? null : 'unsupported');
  }

  async function stop() {
    const audio = await recorder.stop();
    if (audio) send(audio);
  }

  function send(audio: Blob) {
    setUnsent(audio);
    upload.mutate({ audio, consent: true }, { onSuccess: () => setUnsent(null) });
  }

  const mm = String(Math.floor(recorder.seconds / 60)).padStart(2, '0');
  const ss = String(recorder.seconds % 60).padStart(2, '0');

  return (
    <section className="flex flex-col gap-2.5 rounded-panel border border-border-subtle bg-bg-surface p-4">
      <h2 className="text-sm font-semibold text-text-primary">{text.title}</h2>
      <p className="text-[0.8rem] text-text-secondary">{!candidateJoined ? text.waitingAnswer : consent ? text.agreed : text.declined}</p>

      {upload.isSuccess ? (
        <p className="text-sm text-brand-ink">
          {text.sent}{' '}
          <Link href={`/interviewer/interview/${interviewId}`} className="font-semibold underline-offset-2 hover:underline">
            {text.open}
          </Link>
        </p>
      ) : recorder.recording ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-status-low">
            <span className="h-2 w-2 animate-pulse rounded-full bg-status-low" />
            {text.recording} · <span className="font-mono tabular-nums">{mm}:{ss}</span>
          </span>
          <button
            type="button"
            onClick={() => void stop()}
            className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated"
          >
            <StopIcon aria-hidden="true" className="h-4 w-4" />
            {text.stop}
          </button>
        </div>
      ) : candidateJoined && consent && !callOver ? (
        <button
          type="button"
          onClick={start}
          disabled={upload.isPending || room.state !== 'connected'}
          className="inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MicrophoneIcon aria-hidden="true" className="h-4 w-4" />
          {text.start}
        </button>
      ) : null}

      {notice ? <p className="text-[0.8rem] text-status-low">{text[notice]}</p> : null}
      {upload.isError ? (
        <p className="flex flex-wrap items-center gap-2 text-[0.8rem] text-status-low">
          {errorText(upload.error, locale)}
          {unsent ? (
            <button type="button" onClick={() => send(unsent)} className="font-semibold text-text-primary underline-offset-2 hover:underline">
              {text.retry}
            </button>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
