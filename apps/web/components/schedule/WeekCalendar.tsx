'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import { addDays, clockOf, dayKey, formatDayKey, formatTime, fromAlmaty, minutesInDay } from '../../lib/slots/time';
import type { InterviewSlot, SlotStatus } from '../../lib/slots/types';

/** One row of the grid: half an hour. */
const STEP = 30;
const ROW_REM = 1.75;
/** The working day shown when no time falls outside it. */
const DAY_FROM = 8 * 60;
const DAY_TO = 21 * 60;

const block: Record<SlotStatus, string> = {
  open: 'border border-dashed border-brand-ink/50 bg-bg-surface text-text-secondary',
  closed: 'border border-border-subtle bg-bg-elevated text-text-muted',
  booked: 'bg-chip-sky text-chip-ink',
  waiting: 'bg-chip-flag text-chip-ink',
  live: 'bg-brand-green text-on-brand',
  done: 'bg-chip-review text-chip-ink',
  missed: 'bg-chip-flag text-chip-ink opacity-70',
};

export interface WeekCalendarText {
  addAt: (day: string, time: string) => string;
  statusOf: (status: SlotStatus) => string;
  free: string;
}

/**
 * A week of Almaty time, Monday first, in half-hour rows, like a desk
 * calendar. An empty half hour in the future is a button that adds a time
 * there; a time already there is a button that shows it. The rows stretch to
 * take in any time outside the usual working day.
 */
export function WeekCalendar({
  week,
  slots,
  now,
  locale,
  text,
  selected,
  canAdd,
  adding,
  onAdd,
  onSelect,
}: {
  /** The Monday, as a `YYYY-MM-DD` key. */
  week: string;
  slots: InterviewSlot[];
  now: number;
  locale: string;
  text: WeekCalendarText;
  selected: string | null;
  canAdd: boolean;
  adding: boolean;
  onAdd: (startsAt: string) => void;
  onSelect: (slotId: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const inWeek = slots.filter((slot) => days.includes(dayKey(slot.startsAt)));
  const from = Math.min(DAY_FROM, ...inWeek.map((slot) => Math.floor(minutesInDay(slot.startsAt) / 60) * 60));
  const to = Math.max(
    DAY_TO,
    ...inWeek.map((slot) => Math.min(24 * 60, Math.ceil((minutesInDay(slot.startsAt) + slot.durationMin) / 60) * 60)),
  );
  const rows = Array.from({ length: (to - from) / STEP }, (_, index) => from + index * STEP);
  const today = dayKey(new Date(now).toISOString());
  const nowMinutes = minutesInDay(new Date(now).toISOString());
  const top = (minutes: number) => `${((minutes - from) / STEP) * ROW_REM}rem`;

  return (
    <div className="overflow-x-auto rounded-panel border border-border-subtle bg-bg-surface">
      <div className="grid min-w-[34rem] grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
        <div className="border-b border-border-subtle" />
        {days.map((day) => (
          <div
            key={day}
            className="flex flex-col items-center gap-0.5 border-b border-l border-border-subtle py-2"
          >
            <span className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
              {formatDayKey(day, locale, { weekday: 'short' })}
            </span>
            <span
              className={`grid h-7 min-w-7 place-items-center rounded-full px-1 text-sm font-semibold tabular-nums ${
                day === today ? 'bg-brand-green text-on-brand' : 'text-text-primary'
              }`}
            >
              {formatDayKey(day, locale, { day: 'numeric' })}
            </span>
          </div>
        ))}

        <div className="relative">
          {rows.map((minutes) => (
            <div key={minutes} style={{ height: `${ROW_REM}rem` }} className="pr-2 text-right">
              {minutes % 60 === 0 ? (
                <span className="relative -top-2 font-mono text-[0.62rem] tabular-nums text-text-muted">{clockOf(minutes)}</span>
              ) : null}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const daySlots = inWeek.filter((slot) => dayKey(slot.startsAt) === day);
          return (
            <div key={day} className="relative border-l border-border-subtle">
              {rows.map((minutes) => {
                const startsAt = fromAlmaty(day, clockOf(minutes));
                const past = Date.parse(startsAt) <= now;
                const line = minutes % 60 === 0 ? 'border-t border-border-subtle' : 'border-t border-dashed border-border-subtle/60';
                return canAdd && !past ? (
                  <button
                    key={minutes}
                    type="button"
                    disabled={adding}
                    onClick={() => onAdd(startsAt)}
                    aria-label={text.addAt(formatDayKey(day, locale, { weekday: 'short', day: 'numeric', month: 'short' }), clockOf(minutes))}
                    style={{ height: `${ROW_REM}rem` }}
                    className={`group flex w-full items-center justify-center ${line} transition-colors hover:bg-brand-soft/60 disabled:cursor-wait`}
                  >
                    <PlusIcon aria-hidden="true" className="h-3.5 w-3.5 text-brand-ink opacity-0 group-hover:opacity-100" />
                  </button>
                ) : (
                  <div key={minutes} style={{ height: `${ROW_REM}rem` }} className={`${line} ${past ? 'bg-bg-elevated/50' : ''}`} />
                );
              })}

              {day === today && nowMinutes >= from && nowMinutes < to ? (
                <div aria-hidden="true" style={{ top: top(nowMinutes) }} className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-status-low">
                  <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-status-low" />
                </div>
              ) : null}

              {daySlots.map((slot) => {
                const start = minutesInDay(slot.startsAt);
                const range = `${formatTime(slot.startsAt, locale)}–${formatTime(slot.endsAt, locale)}`;
                // Half an hour has room for one line: the start and who booked it.
                const short = slot.durationMin <= STEP;
                return (
                  <button
                    key={slot.slotId}
                    type="button"
                    onClick={() => onSelect(slot.slotId)}
                    aria-pressed={selected === slot.slotId}
                    aria-label={`${range}, ${text.statusOf(slot.status)}, ${slot.candidateLabel ?? text.free}`}
                    style={{ top: top(start), height: `calc(${(slot.durationMin / STEP) * ROW_REM}rem - 2px)` }}
                    className={`absolute inset-x-0.5 z-[6] flex overflow-hidden rounded-control px-1.5 text-left text-[0.68rem] leading-tight shadow-sm transition-shadow hover:shadow-md aria-pressed:ring-2 aria-pressed:ring-brand-ink ${
                      short ? 'items-center gap-1' : 'flex-col py-1'
                    } ${block[slot.status]}`}
                  >
                    <span className="shrink-0 font-mono font-semibold tabular-nums">{formatTime(slot.startsAt, locale)}</span>
                    <span className="min-w-0 truncate">{slot.candidateLabel ?? text.statusOf(slot.status)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
