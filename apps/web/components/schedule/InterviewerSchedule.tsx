'use client';

import { PlusIcon, TrashIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';
import { errorText } from '../../lib/api/errors';
import { useDemoRole } from '../../lib/DemoRoleProvider';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { StaffLocale } from '../../lib/i18n/staffLocale';
import { DEMO_INTERVIEWER_REF } from '../../lib/interview/queries';
import { useCreateSlot, useRemoveSlot, useSlots } from '../../lib/slots/queries';
import { byDay, dayKey, formatDay, formatTime, fromAlmaty, opensAt } from '../../lib/slots/time';
import type { InterviewSlot, SlotStatus } from '../../lib/slots/types';
import { useNow } from '../../lib/slots/useNow';

const copy = {
  en: {
    eyebrow: 'Video interview',
    title: 'Schedule',
    lede: 'Add times you can interview. A candidate books one; the call opens 10 minutes before it, and each side waits at most 5 minutes after the start. A missed time is rebooked on another day.',
    now: (time: string) => `Almaty time: it is now ${time} (UTC+5).`,
    removing: 'Removing — this takes a few seconds…',
    removed: 'The time is removed. The list catches up in a few seconds.',
    add: 'Add a time',
    date: 'Date',
    time: 'Start',
    duration: 'Length',
    minutes: (n: number) => `${n} min`,
    addButton: 'Add',
    soon: 'Add one starting in 2 minutes',
    soonNote: 'For showing the call without waiting.',
    empty: 'No times yet.',
    free: 'Free',
    join: 'Join the call',
    opensAt: (time: string) => `Opens at ${time}`,
    interview: 'Interview page',
    remove: 'Remove',
    status: {
      open: 'Open', closed: 'Not booked', booked: 'Booked', waiting: 'Waiting', live: 'In the call', done: 'Held', missed: 'Missed',
    } satisfies Record<SlotStatus, string>,
    missedBy: { candidate: 'the candidate did not come', interviewer: 'the interviewer did not come', both: 'nobody came' },
  },
  ru: {
    eyebrow: 'Видеоинтервью',
    title: 'Расписание',
    lede: 'Добавьте время, когда можете провести интервью. Кандидат бронирует одно; звонок открывается за 10 минут, и каждая сторона ждёт не больше 5 минут после начала. Пропущенное время бронируют заново на другой день.',
    now: (time: string) => `Время по Алматы: сейчас ${time} (UTC+5).`,
    removing: 'Убираем — это займёт несколько секунд…',
    removed: 'Время убрано. Список обновится через несколько секунд.',
    add: 'Добавить время',
    date: 'Дата',
    time: 'Начало',
    duration: 'Длительность',
    minutes: (n: number) => `${n} мин`,
    addButton: 'Добавить',
    soon: 'Добавить слот через 2 минуты',
    soonNote: 'Чтобы показать звонок без ожидания.',
    empty: 'Времени пока нет.',
    free: 'Свободно',
    join: 'Войти в звонок',
    opensAt: (time: string) => `Откроется в ${time}`,
    interview: 'Страница интервью',
    remove: 'Убрать',
    status: {
      open: 'Свободно', closed: 'Не забронировано', booked: 'Забронировано', waiting: 'Ожидание', live: 'Идёт звонок', done: 'Проведено', missed: 'Пропущено',
    } satisfies Record<SlotStatus, string>,
    missedBy: { candidate: 'кандидат не пришёл', interviewer: 'интервьюер не пришёл', both: 'никто не пришёл' },
  },
};

const tone: Record<SlotStatus, string> = {
  open: 'bg-bg-elevated text-text-secondary',
  closed: 'bg-bg-elevated text-text-muted',
  booked: 'bg-chip-sky text-chip-ink',
  waiting: 'bg-chip-flag text-chip-ink',
  live: 'bg-brand-green text-on-brand',
  done: 'bg-chip-review text-chip-ink',
  missed: 'bg-chip-flag text-chip-ink',
};

const field = 'rounded-control border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary';

/** Tomorrow in Almaty, for the date field's first value. */
function tomorrow(): string {
  return dayKey(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
}

/**
 * The interviewer's side of scheduling: add times, see who booked them, and
 * go into the call when it opens. Times are entered and shown in Almaty
 * time, the zone the API counts days in.
 */
export function InterviewerSchedule() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const { role } = useDemoRole();
  const slots = useSlots();
  const create = useCreateSlot();
  const remove = useRemoveSlot();
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  // A removed time leaves the list at once; the server's list confirms it on the next read.
  const [removed, setRemoved] = useState<string[]>([]);
  const clock = useNow(15_000);
  const canEdit = role === 'interviewer' || role === 'admin';

  const add = (startsAt: string) => create.mutate({ startsAt, interviewerRef: DEMO_INTERVIEWER_REF, durationMin: duration });

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-2xl text-sm text-text-secondary">{text.lede}</p>
      </header>

      {canEdit ? (
        <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary">{text.add}</h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              add(fromAlmaty(date, time));
            }}
          >
            <label className="flex flex-col gap-1 text-[0.75rem] text-text-muted">
              {text.date}
              <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[0.75rem] text-text-muted">
              {text.time}
              <input type="time" required step={300} value={time} onChange={(event) => setTime(event.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[0.75rem] text-text-muted">
              {text.duration}
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={field}>
                {[30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {text.minutes(minutes)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex items-center gap-1.5 rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-dim disabled:opacity-50"
            >
              <PlusIcon aria-hidden="true" className="h-4 w-4" />
              {text.addButton}
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2 text-[0.8rem]">
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => add(new Date(Date.now() + 2 * 60_000).toISOString())}
              className="font-semibold text-brand-ink underline-offset-2 hover:underline disabled:opacity-50"
            >
              {text.soon}
            </button>
            <span className="text-text-muted">{text.soonNote}</span>
          </div>
          <p className="text-[0.75rem] text-text-muted">{text.now(formatTime(new Date(clock).toISOString(), locale))}</p>
          {create.isError ? (
            <p role="alert" className="text-sm text-status-low">
              {errorText(create.error, locale)}
            </p>
          ) : null}
        </section>
      ) : null}

      {remove.isSuccess ? (
        <p role="status" className="text-sm text-text-secondary">
          {text.removed}
        </p>
      ) : null}
      {slots.isError ? (
        <p role="alert" className="text-sm text-text-primary">
          {errorText(slots.error, locale)}
        </p>
      ) : slots.data && slots.data.length === 0 ? (
        <p className="text-sm text-text-secondary">{text.empty}</p>
      ) : (
        byDay((slots.data ?? []).filter((slot) => !removed.includes(slot.slotId))).map(({ day, slots: daySlots }) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-primary">{formatDay(daySlots[0].startsAt, locale)}</h2>
            <ul className="divide-y divide-border-subtle rounded-panel border border-border-subtle bg-bg-surface">
              {daySlots.map((slot) => (
                <SlotRow
                  key={slot.slotId}
                  slot={slot}
                  locale={locale}
                  canEdit={canEdit}
                  removing={remove.isPending && remove.variables === slot.slotId}
                  onRemove={() => remove.mutate(slot.slotId, { onSuccess: () => setRemoved((ids) => [...ids, slot.slotId]) })}
                />
              ))}
            </ul>
          </section>
        ))
      )}
      {remove.isError ? (
        <p role="alert" className="text-sm text-status-low">
          {errorText(remove.error, locale)}
        </p>
      ) : null}
    </main>
  );
}

function SlotRow({
  slot,
  locale,
  canEdit,
  removing,
  onRemove,
}: {
  slot: InterviewSlot;
  locale: StaffLocale;
  canEdit: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const text = copy[locale];
  const now = useNow(5_000);
  const joinable = canEdit && (slot.status === 'booked' || slot.status === 'waiting' || slot.status === 'live' || slot.status === 'done');
  const open = now >= opensAt(slot.startsAt);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="font-mono text-sm tabular-nums text-text-primary">
        {formatTime(slot.startsAt, locale)}–{formatTime(slot.endsAt, locale)}
      </span>
      <span className={`rounded-control px-2 py-0.5 text-[0.72rem] font-semibold ${tone[slot.status]}`}>{text.status[slot.status]}</span>
      <span className="text-sm text-text-secondary">
        {slot.candidateLabel ?? text.free}
        {slot.missedBy ? ` · ${text.missedBy[slot.missedBy]}` : ''}
      </span>
      <span className="ml-auto flex flex-wrap items-center gap-3 text-sm font-semibold">
        {slot.interviewId ? (
          <Link href={`/interviewer/interview/${slot.interviewId}`} className="text-text-secondary hover:underline">
            {text.interview}
          </Link>
        ) : null}
        {joinable && slot.status !== 'done' ? (
          open ? (
            <Link
              href={`/interviewer/schedule/call/${slot.slotId}`}
              className="inline-flex items-center gap-1.5 rounded-control bg-brand-green px-3 py-1.5 text-on-brand hover:bg-brand-dim"
            >
              <VideoCameraIcon aria-hidden="true" className="h-4 w-4" />
              {text.join}
            </Link>
          ) : (
            <span className="font-normal text-text-muted">{text.opensAt(formatTime(new Date(opensAt(slot.startsAt)).toISOString(), locale))}</span>
          )
        ) : null}
        {removing ? (
          <span className="font-normal text-text-muted" role="status">
            {text.removing}
          </span>
        ) : canEdit && slot.status === 'open' ? (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-text-muted hover:text-status-low">
            <TrashIcon aria-hidden="true" className="h-4 w-4" />
            {text.remove}
          </button>
        ) : null}
      </span>
    </li>
  );
}
