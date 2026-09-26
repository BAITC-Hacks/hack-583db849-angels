'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { addDays, addMonths, formatDayKey, monthGrid, weekStart } from '../../lib/slots/time';

const WEEKDAYS = Array.from({ length: 7 }, (_, index) => addDays(weekStart('2026-09-28'), index));

/**
 * A month page for picking a day, Monday first. Days with times to choose
 * carry a dot and the count; a day that cannot be chosen says why in its
 * label. English only: it is on the candidate's side.
 */
export function MonthCalendar({
  month,
  onMonth,
  today,
  counts,
  blocked,
  selected,
  onSelect,
}: {
  /** The first of the month, as a `YYYY-MM-DD` key. */
  month: string;
  onMonth: (month: string) => void;
  today: string;
  /** How many open times each day has. */
  counts: Map<string, number>;
  blocked: Set<string>;
  selected: string | null;
  onSelect: (day: string) => void;
}) {
  const days = monthGrid(month);
  const inMonth = (day: string) => day.slice(0, 7) === month.slice(0, 7);

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onMonth(addMonths(month, -1))}
          disabled={month <= today.slice(0, 7) + '-01'}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-control text-text-primary hover:bg-bg-elevated disabled:opacity-30"
        >
          <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-text-primary">{formatDayKey(month, 'en', { month: 'long', year: 'numeric' })}</p>
        <button
          type="button"
          onClick={() => onMonth(addMonths(month, 1))}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-control text-text-primary hover:bg-bg-elevated"
        >
          <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
            {formatDayKey(day, 'en', { weekday: 'short' }).slice(0, 2)}
          </span>
        ))}
        {days.map((day) => {
          const count = counts.get(day) ?? 0;
          const isBlocked = blocked.has(day) && count > 0;
          const available = count > 0 && !isBlocked && day >= today;
          const name = formatDayKey(day, 'en');
          const label = isBlocked
            ? `${name}, not available after the missed time`
            : available
              ? `${name}, ${count} ${count === 1 ? 'time' : 'times'}`
              : `${name}, no times`;
          return (
            <button
              key={day}
              type="button"
              disabled={!available}
              onClick={() => onSelect(day)}
              aria-pressed={selected === day}
              aria-label={label}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-control text-sm tabular-nums transition-colors ${
                !inMonth(day) ? 'opacity-40' : ''
              } ${
                selected === day
                  ? 'bg-brand-green font-bold text-on-brand'
                  : available
                    ? 'bg-brand-soft font-semibold text-text-primary hover:ring-2 hover:ring-brand-green'
                    : isBlocked
                      ? 'text-text-muted line-through'
                      : 'text-text-muted'
              } ${day === today && selected !== day ? 'ring-1 ring-border-strong' : ''} disabled:cursor-default`}
            >
              {formatDayKey(day, 'en', { day: 'numeric' })}
              {available ? (
                <span aria-hidden="true" className={`absolute bottom-1 h-1 w-1 rounded-full ${selected === day ? 'bg-on-brand' : 'bg-brand-ink'}`} />
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-brand-soft" />
          Times to choose
        </span>
        {blocked.size > 0 ? <span className="line-through">Not available after a missed time</span> : null}
      </p>
    </div>
  );
}
