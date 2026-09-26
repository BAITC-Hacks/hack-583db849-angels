'use client';

import { ArrowRightIcon, CalendarDaysIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';
import { candidateByCode, useCandidates } from '../../lib/api/candidates';
import { errorText } from '../../lib/api/errors';
import { useBookSlot, useSlots } from '../../lib/slots/queries';
import { dayKey, formatDay, formatDayKey, formatTime, monthStart, opensAt } from '../../lib/slots/time';
import type { InterviewSlot } from '../../lib/slots/types';
import { useNow } from '../../lib/slots/useNow';
import { MonthCalendar } from './MonthCalendar';

const action =
  'inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50';

function range(slot: InterviewSlot): string {
  return `${formatTime(slot.startsAt, 'en')}–${formatTime(slot.endsAt, 'en')}`;
}

/**
 * The candidate books the live interview, in English only: a day on the
 * month calendar, then a time on that day. One time at a time; after a
 * missed one, the same day is not offered again — the API says the same,
 * this only shows it before anyone presses a button.
 */
export function CandidateInterview() {
  const candidates = useCandidates();
  const me = candidateByCode(candidates.data, 'A');
  const slots = useSlots({ open: true, candidateId: me?.candidateId }, { enabled: Boolean(me) });
  const book = useBookSlot();
  const now = useNow(5_000);
  const [chosen, setChosen] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);

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

  const today = dayKey(new Date(now).toISOString());
  const counts = new Map<string, number>();
  for (const slot of open) counts.set(dayKey(slot.startsAt), (counts.get(dayKey(slot.startsAt)) ?? 0) + 1);
  const availableDays = [...counts.keys()].filter((key) => !blockedDays.has(key) && key >= today).sort();
  // The first day with a time to choose, until the candidate picks another.
  const day = pickedDay && availableDays.includes(pickedDay) ? pickedDay : (availableDays[0] ?? null);
  const dayTimes = day ? open.filter((slot) => dayKey(slot.startsAt) === day) : [];
  const chosenSlot = dayTimes.find((slot) => slot.slotId === chosen);
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

      {counts.size === 0 ? (
        <p className="rounded-panel border border-dashed border-border-strong p-6 text-sm text-text-secondary">
          No interview times are open yet. New times appear here as soon as the admissions team adds them.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,22rem)_1fr]">
          <MonthCalendar
            month={month ?? monthStart(day ?? today)}
            onMonth={setMonth}
            today={today}
            counts={counts}
            blocked={blockedDays}
            selected={day}
            onSelect={(key) => {
              setPickedDay(key);
              setChosen(null);
            }}
          />
          <section className="flex flex-col gap-3">
            {day ? (
              <>
                <h2 className="text-sm font-semibold text-text-primary">{formatDayKey(day, 'en')}</h2>
                <p className="text-[0.8rem] text-text-muted">Choose a time. Times are in Almaty time (UTC+5).</p>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                  {dayTimes.map((slot) => (
                    <li key={slot.slotId}>
                      <button
                        type="button"
                        disabled={book.isPending}
                        aria-pressed={chosen === slot.slotId}
                        onClick={() => setChosen(slot.slotId)}
                        className="w-full rounded-control border border-border-strong px-3 py-2.5 font-mono whitespace-nowrap text-sm tabular-nums text-text-primary transition-colors hover:border-brand-green hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-brand-green aria-pressed:bg-brand-soft"
                      >
                        {range(slot)}
                      </button>
                    </li>
                  ))}
                </ul>
                {chosenSlot ? (
                  <button type="button" disabled={book.isPending} onClick={() => book.mutate({ slotId: chosenSlot.slotId, candidateId: me.candidateId })} className={action}>
                    {book.isPending ? 'Booking…' : `Book ${formatDay(chosenSlot.startsAt, 'en')}, ${range(chosenSlot)}`}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                {blockedDays.size > 0 ? 'The only open times are on the day of the missed time. New days appear here as soon as they are added.' : 'Choose a day with times.'}
              </p>
            )}
          </section>
        </div>
      )}
      <p className="text-[0.8rem] text-text-muted">Almaty time: it is now {formatTime(new Date(now).toISOString(), 'en')} (UTC+5).</p>
      {book.isError ? (
        <p role="alert" className="text-sm font-semibold text-text-primary">
          {errorText(book.error)}
        </p>
      ) : null}
    </div>
  );
}
