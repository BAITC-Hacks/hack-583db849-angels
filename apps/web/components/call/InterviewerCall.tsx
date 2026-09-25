'use client';

import { VideoCameraIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';
import { errorText } from '../../lib/api/errors';
import { useCallRoom } from '../../lib/call/useCallRoom';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { useJoinCall, useSlot } from '../../lib/slots/queries';
import { countdown, formatDay, formatTime } from '../../lib/slots/time';
import { useNow } from '../../lib/slots/useNow';
import { CallRecordingPanel } from './CallRecordingPanel';
import { CallSidebar } from './CallSidebar';
import { CallStage } from './CallStage';

const copy = {
  en: {
    eyebrow: 'Video interview',
    almaty: 'Almaty time',
    join: 'Join the call',
    joining: 'Joining…',
    rejoin: 'Join again',
    failed: 'Could not connect to the call. Check the connection and try again.',
    ended: 'You have left the call.',
    openInterview: 'Open the interview page',
    back: 'Back to the schedule',
    missed: (who: string) => `This slot is missed: ${who} within 5 minutes of the start.`,
    who: { candidate: 'the candidate did not join', interviewer: 'the interviewer did not join', both: 'neither side joined' },
    waitingStart: (time: string) => `The candidate has not joined yet. The interview starts at ${time}.`,
    waiting: (left: string) => `Waiting for the candidate · ${left} left of the 5 minutes`,
    stage: {
      other: 'Candidate',
      you: 'You',
      otherCameraOff: 'The candidate’s camera is off.',
      mute: 'Mute',
      unmute: 'Unmute',
      cameraOff: 'Camera off',
      cameraOn: 'Camera on',
      leave: 'Leave',
    },
  },
  ru: {
    eyebrow: 'Видеоинтервью',
    almaty: 'время Алматы',
    join: 'Войти в звонок',
    joining: 'Подключаемся…',
    rejoin: 'Войти снова',
    failed: 'Не удалось подключиться к звонку. Проверьте связь и попробуйте ещё раз.',
    ended: 'Вы вышли из звонка.',
    openInterview: 'Открыть страницу интервью',
    back: 'К расписанию',
    missed: (who: string) => `Слот пропущен: ${who} в течение 5 минут после начала.`,
    who: { candidate: 'кандидат не вошёл', interviewer: 'интервьюер не вошёл', both: 'никто не вошёл' },
    waitingStart: (time: string) => `Кандидат ещё не вошёл. Интервью начинается в ${time}.`,
    waiting: (left: string) => `Ждём кандидата · осталось ${left} из 5 минут`,
    stage: {
      other: 'Кандидат',
      you: 'Вы',
      otherCameraOff: 'Камера кандидата выключена.',
      mute: 'Выключить микрофон',
      unmute: 'Включить микрофон',
      cameraOff: 'Выключить камеру',
      cameraOn: 'Включить камеру',
      leave: 'Выйти',
    },
  },
};

/**
 * The interviewer's side of the video interview: the candidate large, the
 * interviewer small, and beside them the brief's questions, notes and blind
 * scores. Recording is audio only and waits for the candidate's consent.
 */
export function InterviewerCall({ slotId }: { slotId: string }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const slot = useSlot(slotId);
  const join = useJoinCall(slotId);
  const room = useCallRoom();
  const now = useNow();
  const [interviewId, setInterviewId] = useState<string | null>(null);

  async function enter() {
    const access = await join.mutateAsync({}).catch(() => null);
    if (!access) return;
    setInterviewId(access.interviewId ?? null);
    await room.connect(access);
  }

  if (slot.isError) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p role="alert" className="text-sm text-text-primary">
          {errorText(slot.error, locale)}
        </p>
      </main>
    );
  }
  if (!slot.data) return null;
  const data = slot.data;
  const time = `${formatTime(data.startsAt, locale)}–${formatTime(data.endsAt, locale)}`;
  const inCall = room.state === 'connected' || room.state === 'connecting';
  const started = now >= Date.parse(data.startsAt);
  const notice = started ? text.waiting(countdown(Date.parse(data.waitUntil) - now)) : text.waitingStart(formatTime(data.startsAt, locale));
  const currentInterview = interviewId ?? data.interviewId;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{data.candidateLabel ?? '—'}</h1>
        <p className="text-sm text-text-secondary">
          {formatDay(data.startsAt, locale)}, {time} ({text.almaty})
        </p>
      </header>

      {/* The recording and the sidebar keep their place when the call ends, so a
          recording is sent rather than lost and unsaved scores survive leaving. */}
      <div className={`grid items-start gap-5 ${currentInterview && data.candidateId ? 'lg:grid-cols-[1fr_24rem]' : ''}`}>
        <div className="flex flex-col gap-4">
          {inCall ? (
            <CallStage room={room} copy={text.stage} notice={notice} />
          ) : (
            <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
              {data.status === 'missed' ? (
                <p className="text-sm text-text-primary">{text.missed(text.who[data.missedBy ?? 'both'])}</p>
              ) : (
                <>
                  {room.state === 'ended' ? <p className="text-sm text-text-secondary">{text.ended}</p> : null}
                  {room.state === 'failed' ? (
                    <p role="alert" className="text-sm text-status-low">
                      {text.failed}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void enter()}
                    disabled={join.isPending}
                    className="inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <VideoCameraIcon aria-hidden="true" className="h-4 w-4" />
                    {join.isPending ? text.joining : room.state === 'ended' ? text.rejoin : text.join}
                  </button>
                  {join.isError ? (
                    <p role="alert" className="text-sm text-text-primary">
                      {errorText(join.error, locale)}
                    </p>
                  ) : null}
                </>
              )}
              <div className="flex flex-wrap gap-4 text-sm font-semibold">
                {currentInterview ? (
                  <Link href={`/interviewer/interview/${currentInterview}`} className="text-brand-ink hover:underline">
                    {text.openInterview}
                  </Link>
                ) : null}
                <Link href="/interviewer/schedule" className="text-text-secondary hover:underline">
                  {text.back}
                </Link>
              </div>
            </section>
          )}
          {currentInterview && (inCall || room.state === 'ended') ? (
            <CallRecordingPanel room={room} interviewId={currentInterview} candidateJoined={Boolean(data.candidateJoinedAt)} consent={data.consentRecording} />
          ) : null}
        </div>
        {currentInterview && data.candidateId ? (
          <div className="lg:sticky lg:top-6">
            <CallSidebar interviewId={currentInterview} candidateId={data.candidateId} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
