/**
 * The admissions office's clock. Slots are shown, entered and counted in
 * days in this zone, the same one the API counts "another day" in
 * (`INTERVIEW_TIME_ZONE`). Kazakhstan has one zone, UTC+5, all year.
 */
export const INTERVIEW_TIME_ZONE = 'Asia/Almaty';
/** How the zone is written next to a time: the offset, which reads the same in every language. */
export const ZONE_LABEL = 'UTC+5';
const OFFSET = '+05:00';

/** The call opens this long before the start; the API holds the same rule. */
export const JOIN_OPENS_MINUTES = 10;

/** `YYYY-MM-DD` of a moment, in Almaty. */
export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: INTERVIEW_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** A date and a time typed in Almaty, as the ISO moment the API takes. */
export function fromAlmaty(date: string, time: string): string {
  return new Date(`${date}T${time}:00${OFFSET}`).toISOString();
}

export function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: INTERVIEW_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}

export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: INTERVIEW_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function opensAt(startsAt: string): number {
  return Date.parse(startsAt) - JOIN_OPENS_MINUTES * 60_000;
}

/** `m:ss` for a countdown; never below zero. */
export function countdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Slots grouped by their Almaty day, in order. */
export function byDay<T extends { startsAt: string }>(slots: T[]): { day: string; slots: T[] }[] {
  const days = new Map<string, T[]>();
  for (const slot of slots) {
    const key = dayKey(slot.startsAt);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  return [...days.entries()].map(([day, items]) => ({ day, slots: items }));
}

// Calendar arithmetic. A day is its `YYYY-MM-DD` key in Almaty; adding days to
// a key is plain date arithmetic, so it runs in UTC where no clock changes.
const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MINUTES = 5 * 60;

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 for Monday … 6 for Sunday: weeks here start on Monday, as in Kazakhstan. */
export function weekdayOf(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function weekStart(day: string): string {
  return addDays(day, -weekdayOf(day));
}

/** The first of the month a day is in. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function addMonths(month: string, months: number): string {
  const date = new Date(`${month}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/** Every day shown on a month page: whole weeks, Monday first, including the edges of the months around it. */
export function monthGrid(month: string): string[] {
  const first = weekStart(month);
  const next = addMonths(month, 1);
  const days: string[] = [];
  for (let day = first; day < next || weekdayOf(day) !== 0; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Minutes since midnight in Almaty. */
export function minutesInDay(iso: string): number {
  const minutes = Math.floor(Date.parse(iso) / 60_000) + OFFSET_MINUTES;
  return ((minutes % 1440) + 1440) % 1440;
}

/** `HH:MM` for minutes since midnight. */
export function clockOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** A calendar day's name, from its key; noon keeps it on the same date in any zone. */
export function formatDayKey(day: string, locale: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(new Date(`${day}T12:00:00Z`));
}
