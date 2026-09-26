'use client';

import { ArrowRightIcon, CalendarDaysIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';
import { candidateByCode, useCandidates } from '../../lib/api/candidates';
import { errorText } from '../../lib/api/errors';
import { useBookSlot, useSlots } from '../../lib/slots/queries';
import { byDay, dayKey, formatDay, formatTime, opensAt } from '../../lib/slots/time';
import type { InterviewSlot } from '../../lib/slots/types';
import { useNow } from '../../lib/slots/useNow';

const action =
  'inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50';

function range(slot: InterviewSlot): string {
  return `${formatTime(slot.startsAt, 'en')}–${formatTime(slot.endsAt, 'en')}`;
}

/**
 * The candidate books the live interview, in English only. One time at a
 * time; after a missed one, the same day is not offered again — the API says
 * the same, this only shows it before anyone presses a button.
 */
export function CandidateInterview() {
  const candidates = useCandidates();
  const me = candidateByCode(candidates.data, 'A');
  const slots = useSlots({ open: true, candidateId: me?.candidateId }, { enabled: Boolean(me) });
  const book = useBookSlot();
  const now = useNow(5_000);
  const [chosen, setChosen] = useState<string | null>(null);

  if (candidates.isError || slots.isError) {
    return (
      <p role="alert" className="text-sm text-text-primary">
        {errorText(candidates.error ?? slots.error)}
      </p>
    );
  }
  if (!me || !slots.data) return <p className="text-sm text-text-secondary">Loading…</p>;

  const mine = slots.data.filter((slot) => slot.candidateId === me.candidateId);
  const current = mine.find((slot) => slot.status === 'booked' || slot.status === 'waiting' || slot.status === 'live');
  const held = mine.find((slot) => slot.status === 'done');
  const missed = mine.filter((slot) => slot.status === 'missed');
  const blockedDays = new Set(missed.map((slot) => dayKey(slot.startsAt)));
  const open = slots.data.filter((slot) => slot.status === 'open');

  if (held) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-panel border border-border-subtle bg-bg-surface p-8 text-center">
        <CheckCircleIcon aria-hidden="true" className="h-7 w-7 text-brand-ink" />
        <h2 className="text-lg font-bold text-text-primary">Your interview has taken place</h2>
        <p className="max-w-lg text-sm text-text-secondary">Thank you. There is nothing else to do here.</p>
      </section>
    );
  }

  if (current) {
    const canJoin = now >= opensAt(current.startsAt);
    return (
      <section className="flex flex-col gap-3 rounded-panel border border-brand-green bg-bg-surface p-5">
        <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">Your interview</p>
        <p className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <CalendarDaysIcon aria-hidden="true" className="h-5 w-5 text-text-muted" />
          {formatDay(current.startsAt, 'en')}, {range(current)}
        </p>
        <p className="text-sm text-text-secondary">
          Almaty time (UTC+5), on video, in English, about {current.durationMin} minutes. The call opens 10 minutes before the start, and
          each side waits at most 5 minutes after it.
        </p>
        {canJoin ? (
          <Link href={`/candidate/interview/call/${current.slotId}`} className={`group ${action}`}>
            Join the interview
            <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <p className="text-sm font-semibold text-text-primary">The call opens at {formatTime(new Date(opensAt(current.startsAt)).toISOString(), 'en')}.</p>
        )}
      </section>
    );
  }

  const days = byDay(open);
  const chosenSlot = open.find((slot) => slot.slotId === chosen && !blockedDays.has(dayKey(slot.startsAt)));
  return (
    <div className="flex flex-col gap-5">
      {missed.length > 0 ? (
        <section className="rounded-panel border border-border-subtle bg-bg-elevated p-5 text-sm text-text-secondary">
          <h2 className="font-semibold text-text-primary">Your last interview time closed</h2>
          <p className="mt-1">
            {missed.at(-1)?.missedBy === 'interviewer'
              ? 'The interviewer could not join in time. We are sorry — this does not count against you.'
              : 'Nobody joined within five minutes of the start.'}{' '}
            Choose a new time on another day.
          </p>
        </section>
      ) : null}

      {days.length === 0 ? (
        <p className="rounded-panel border border-dashed border-border-strong p-6 text-sm text-text-secondary">
          No interview times are open yet. New times appear here as soon as the admissions team adds them.
        </p>
      ) : (
        days.map(({ day, slots: daySlots }) => {
          const blocked = blockedDays.has(day);
          return (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                {formatDay(daySlots[0].startsAt, 'en')}
                {blocked ? <span className="ml-2 font-normal text-text-muted">· not available after the missed time</span> : null}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <li key={slot.slotId}>
                    <button
                      type="button"
                      disabled={blocked || book.isPending}
                      aria-pressed={chosen === slot.slotId}
                      onClick={() => setChosen(slot.slotId)}
                      className="rounded-control border border-border-strong px-3 py-2 font-mono text-sm tabular-nums text-text-primary transition-colors hover:border-brand-green hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-brand-green aria-pressed:bg-brand-soft"
                    >
                      {range(slot)}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      {chosenSlot ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={book.isPending} onClick={() => book.mutate({ slotId: chosenSlot.slotId, candidateId: me.candidateId })} className={action}>
            {book.isPending ? 'Booking…' : `Book ${formatDay(chosenSlot.startsAt, 'en')}, ${range(chosenSlot)}`}
          </button>
        </div>
      ) : null}
      <p className="text-[0.8rem] text-text-muted">Almaty time: it is now {formatTime(new Date(now).toISOString(), 'en')} (UTC+5).</p>
      {book.isError ? (
        <p role="alert" className="text-sm font-semibold text-text-primary">
          {errorText(book.error)}
        </p>
      ) : null}
    </div>
  );
}
