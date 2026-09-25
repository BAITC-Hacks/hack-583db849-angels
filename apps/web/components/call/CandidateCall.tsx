'use client';

import { VideoCameraIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { errorText } from '../../lib/api/errors';
import { useCallRoom } from '../../lib/call/useCallRoom';
import { useJoinCall, useSlot } from '../../lib/slots/queries';
import { countdown, formatDay, formatTime } from '../../lib/slots/time';
import { useNow } from '../../lib/slots/useNow';
import { CallStage } from './CallStage';

const stage = {
  other: 'Interviewer',
  you: 'You',
  otherCameraOff: 'The interviewer’s camera is off.',
  mute: 'Mute',
  unmute: 'Unmute',
  cameraOff: 'Camera off',
  cameraOn: 'Camera on',
  leave: 'Leave',
};

/**
 * The candidate's side of the video interview, in English only: the
 * interviewer large, the candidate small. Before joining they answer one
 * question — may the call be recorded as audio for transcription — and the
 * interview goes ahead either way. Nothing here scores or hints at a decision.
 */
export function CandidateCall({ slotId }: { slotId: string }) {
  const slot = useSlot(slotId);
  const join = useJoinCall(slotId);
  const room = useCallRoom();
  const now = useNow();
  const [consent, setConsent] = useState(false);

  // The interviewer did not come within the five minutes: the room has nothing more to offer.
  const missed = slot.data?.status === 'missed';
  const { leave } = room;
  useEffect(() => {
    if (missed) leave();
  }, [leave, missed]);

  async function enter() {
    const access = await join.mutateAsync({ consentRecording: consent }).catch(() => null);
    if (access) await room.connect(access);
  }

  if (slot.isError) {
    return (
      <p role="alert" className="text-sm text-text-primary">
        {errorText(slot.error)}
      </p>
    );
  }
  if (!slot.data) return <p className="text-sm text-text-secondary">Loading…</p>;
  const data = slot.data;
  const when = `${formatDay(data.startsAt, 'en')}, ${formatTime(data.startsAt, 'en')}–${formatTime(data.endsAt, 'en')} (Almaty time)`;
  const started = now >= Date.parse(data.startsAt);
  const notice = started
    ? `The interviewer will be with you in a moment. They have ${countdown(Date.parse(data.waitUntil) - now)} left to join.`
    : `You are in. The interview starts at ${formatTime(data.startsAt, 'en')}; the interviewer joins then.`;

  if (missed) {
    return (
      <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-6">
        <h2 className="text-lg font-bold text-text-primary">This interview time has closed</h2>
        <p className="text-sm text-text-secondary">
          {data.missedBy === 'interviewer'
            ? 'The interviewer could not join within five minutes of the start. We are sorry — this does not count against you.'
            : 'Nobody waits more than five minutes after the start, so this time is closed.'}{' '}
          Please book a new time on another day.
        </p>
        <Link href="/candidate/interview" className="w-fit text-sm font-semibold text-brand-ink hover:underline">
          Book another day
        </Link>
      </section>
    );
  }

  if (room.state === 'connected' || room.state === 'connecting') {
    return <CallStage room={room} copy={stage} notice={notice} />;
  }

  return (
    <section className="flex flex-col gap-4 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <p className="text-sm text-text-primary">{when}</p>
      {room.state === 'ended' ? <p className="text-sm text-text-secondary">You have left the call. You can join again while the interview is on.</p> : null}
      {room.state === 'failed' ? (
        <p role="alert" className="text-sm text-text-primary">
          Could not connect to the call. Check your connection and try again.
        </p>
      ) : null}

      <label className="flex items-start gap-2.5 text-sm text-text-secondary">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-green" />
        I agree to this interview being recorded as audio and transcribed, so the admissions team can read it back. The video
        is never recorded. The interview goes ahead either way.
      </label>

      <button
        type="button"
        onClick={() => void enter()}
        disabled={join.isPending}
        className="inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
      >
        <VideoCameraIcon aria-hidden="true" className="h-4 w-4" />
        {join.isPending ? 'Joining…' : room.state === 'ended' ? 'Join again' : 'Join the interview'}
      </button>
      <p className="text-[0.8rem] text-text-muted">
        Your browser will ask for the camera and the microphone. Each side waits at most five minutes after the start.
      </p>
      {join.isError ? (
        <p role="alert" className="text-sm font-semibold text-text-primary">
          {errorText(join.error)}
        </p>
      ) : null}
    </section>
  );
}
