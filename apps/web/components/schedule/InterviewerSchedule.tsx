'use client';

import { ChevronLeftIcon, ChevronRightIcon, TrashIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';
import { errorText } from '../../lib/api/errors';
import { useDemoRole } from '../../lib/DemoRoleProvider';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { StaffLocale } from '../../lib/i18n/staffLocale';
import { DEMO_INTERVIEWER_REF } from '../../lib/interview/queries';
import { useCreateSlot, useRemoveSlot, useSlots } from '../../lib/slots/queries';
import { addDays, dayKey, formatDay, formatDayKey, formatTime, opensAt, weekStart } from '../../lib/slots/time';
import { isComing, type InterviewSlot, type SlotStatus } from '../../lib/slots/types';
import { useNow } from '../../lib/slots/useNow';
import { WeekCalendar } from './WeekCalendar';

const copy = {
  en: {
    eyebrow: 'Video interview',
    title: 'Schedule',
    lede: 'Click an empty half hour to offer it. A candidate books one; the call opens 10 minutes before it, and each side waits at most 5 minutes after the start. A missed time is rebooked on another day.',
    now: (time: string) => `Almaty time: it is now ${time} (UTC+5).`,
    removing: 'Removing — this takes a few seconds…',
    removed: 'The time is removed. The calendar catches up in a few seconds.',
    adding: 'Adding the time…',
    previous: 'Previous week',
    next: 'Next week',
    thisWeek: 'This week',
    duration: 'Length',
    minutes: (n: number) => `${n} min`,
    addAt: (day: string, time: string) => `Add ${day}, ${time}`,
    soon: 'Add one starting in 2 minutes',
    soonNote: 'For showing the call without waiting.',
    hintEdit: 'Click an empty half hour to add a time there. Click a time to see it.',
    hintView: 'Click a time to see who booked it.',
    coming: 'Coming up',
    noneComing: 'No booked interviews yet.',
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
    lede: 'Нажмите на свободные полчаса, чтобы предложить это время. Кандидат бронирует одно; звонок открывается за 10 минут, и каждая сторона ждёт не больше 5 минут после начала. Пропущенное время бронируют заново на другой день.',
    now: (time: string) => `Время по Алматы: сейчас ${time} (UTC+5).`,
    removing: 'Убираем — это займёт несколько секунд…',
    removed: 'Время убрано. Календарь обновится через несколько секунд.',
    adding: 'Добавляем время…',
    previous: 'Предыдущая неделя',
    next: 'Следующая неделя',
    thisWeek: 'Эта неделя',
    duration: 'Длительность',
    minutes: (n: number) => `${n} мин`,
    addAt: (day: string, time: string) => `Добавить ${day}, ${time}`,
    soon: 'Добавить слот через 2 минуты',
    soonNote: 'Чтобы показать звонок без ожидания.',
    hintEdit: 'Нажмите на свободные полчаса, чтобы добавить время. Нажмите на время, чтобы открыть его.',
    hintView: 'Нажмите на время, чтобы увидеть, кто его забронировал.',
    coming: 'Ближайшие',
    noneComing: 'Забронированных интервью пока нет.',
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
const navButton = 'grid h-9 w-9 place-items-center rounded-control border border-border-strong text-text-primary hover:bg-bg-elevated';

/**
 * The interviewer's side of scheduling, as a week calendar: click an empty
 * half hour to offer it, click a time to see who booked it, and go into the
 * call when it opens. Everything is in Almaty time, the zone the API counts
 * days in.
 */
export function InterviewerSchedule() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const { role } = useDemoRole();
  const slots = useSlots();
  const create = useCreateSlot();
  const remove = useRemoveSlot();
  const clock = useNow(15_000);
  const [week, setWeek] = useState(() => weekStart(dayKey(new Date().toISOString())));
  const [duration, setDuration] = useState(30);
  const [selected, setSelected] = useState<string | null>(null);
  // A removed time leaves the calendar at once; the server's list confirms it on the next read.
  const [removed, setRemoved] = useState<string[]>([]);
  const canEdit = role === 'interviewer' || role === 'admin';

  const shown = (slots.data ?? []).filter((slot) => !removed.includes(slot.slotId));
  const chosen = shown.find((slot) => slot.slotId === selected) ?? null;
  const coming = shown.filter((slot) => isComing(slot.status)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const add = (startsAt: string) =>
    create.mutate({ startsAt, interviewerRef: DEMO_INTERVIEWER_REF, durationMin: duration }, { onSuccess: (slot) => setSelected(slot.slotId) });
  const show = (slot: InterviewSlot) => {
    setWeek(weekStart(dayKey(slot.startsAt)));
    setSelected(slot.slotId);
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setWeek(addDays(week, -7))} aria-label={text.previous} className={navButton}>
            <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeek(weekStart(dayKey(new Date().toISOString())))}
            className="h-9 rounded-control border border-border-strong px-3 text-sm font-semibold text-text-primary hover:bg-bg-elevated"
          >
            {text.thisWeek}
          </button>
          <button type="button" onClick={() => setWeek(addDays(week, 7))} aria-label={text.next} className={navButton}>
            <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <p className="text-base font-bold text-text-primary">
          {formatDayKey(week, locale, { day: 'numeric', month: 'short' })} – {formatDayKey(addDays(week, 6), locale, { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        {canEdit ? (
          <label className="ml-auto flex items-center gap-2 text-[0.8rem] text-text-muted">
            {text.duration}
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={field}>
              {[30, 45, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {text.minutes(minutes)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem]">
        <span className="text-text-muted">{text.now(formatTime(new Date(clock).toISOString(), locale))}</span>
        {canEdit ? (
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => add(new Date(Date.now() + 2 * 60_000).toISOString())}
              className="font-semibold text-brand-ink underline-offset-2 hover:underline disabled:opacity-50"
            >
              {text.soon}
            </button>
            <span className="text-text-muted">{text.soonNote}</span>
          </span>
        ) : null}
      </div>

      {slots.isError ? (
        <p role="alert" className="text-sm text-text-primary">
          {errorText(slots.error, locale)}
        </p>
      ) : null}
      {create.isPending ? (
        <p role="status" className="text-sm text-text-secondary">
          {text.adding}
        </p>
      ) : create.isError ? (
        <p role="alert" className="text-sm text-status-low">
          {errorText(create.error, locale)}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <WeekCalendar
          week={week}
          slots={shown}
          now={clock}
          locale={locale}
          text={{ addAt: text.addAt, statusOf: (status) => text.status[status], free: text.free }}
          selected={selected}
          canAdd={canEdit}
          adding={create.isPending}
          onAdd={add}
          onSelect={setSelected}
        />

        <aside className="flex flex-col gap-4">
          {chosen ? (
            <SlotDetails
              slot={chosen}
              locale={locale}
              canEdit={canEdit}
              removing={remove.isPending && remove.variables === chosen.slotId}
              onRemove={() =>
                remove.mutate(chosen.slotId, {
                  onSuccess: () => {
                    setRemoved((ids) => [...ids, chosen.slotId]);
                    setSelected(null);
                  },
                })
              }
            />
          ) : (
            <p className="rounded-panel border border-dashed border-border-strong p-4 text-sm text-text-secondary">
              {canEdit ? text.hintEdit : text.hintView}
            </p>
          )}
          {remove.isSuccess && !remove.isPending ? (
            <p role="status" className="text-sm text-text-secondary">
              {text.removed}
            </p>
          ) : null}
          {remove.isError ? (
            <p role="alert" className="text-sm text-status-low">
              {errorText(remove.error, locale)}
            </p>
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">{text.coming}</h2>
            {coming.length === 0 ? (
              <p className="text-sm text-text-secondary">{text.noneComing}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle rounded-panel border border-border-subtle bg-bg-surface">
                {coming.map((slot) => (
                  <li key={slot.slotId} className="flex flex-col gap-1.5 px-3 py-2.5">
                    <button type="button" onClick={() => show(slot)} className="flex flex-col text-left hover:underline">
                      <span className="text-[0.78rem] text-text-muted">{formatDay(slot.startsAt, locale)}</span>
                      <span className="font-mono text-sm tabular-nums text-text-primary">
                        {formatTime(slot.startsAt, locale)}–{formatTime(slot.endsAt, locale)} · {slot.candidateLabel ?? text.free}
                      </span>
                    </button>
                    {canEdit ? <JoinAction slot={slot} locale={locale} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

/** Into the call once it opens, ten minutes before the start; until then, when that is. */
function JoinAction({ slot, locale }: { slot: InterviewSlot; locale: StaffLocale }) {
  const text = copy[locale];
  const now = useNow(5_000);
  if (!isComing(slot.status)) return null;
  return now >= opensAt(slot.startsAt) ? (
    <Link
      href={`/interviewer/schedule/call/${slot.slotId}`}
      className="inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-3 py-1.5 text-sm font-semibold text-on-brand hover:bg-brand-dim"
    >
      <VideoCameraIcon aria-hidden="true" className="h-4 w-4" />
      {text.join}
    </Link>
  ) : (
    <span className="text-[0.8rem] text-text-muted">{text.opensAt(formatTime(new Date(opensAt(slot.startsAt)).toISOString(), locale))}</span>
  );
}

function SlotDetails({
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
  return (
    <section aria-label={formatDay(slot.startsAt, locale)} className="flex flex-col gap-2.5 rounded-panel border border-border-subtle bg-bg-surface p-4">
      <p className="text-[0.78rem] text-text-muted">{formatDay(slot.startsAt, locale)}</p>
      <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
        {formatTime(slot.startsAt, locale)}–{formatTime(slot.endsAt, locale)}
      </p>
      <p className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        <span className={`rounded-control px-2 py-0.5 text-[0.72rem] font-semibold ${tone[slot.status]}`}>{text.status[slot.status]}</span>
        {slot.candidateLabel ?? text.free}
        {slot.missedBy ? ` · ${text.missedBy[slot.missedBy]}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        {slot.interviewId ? (
          <Link href={`/interviewer/interview/${slot.interviewId}`} className="text-text-secondary hover:underline">
            {text.interview}
          </Link>
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
      </div>
    </section>
  );
}
