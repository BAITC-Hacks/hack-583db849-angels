/**
 * The admissions office's clock. Slots are shown, entered and counted in
 * days in this zone, the same one the API counts "another day" in
 * (`INTERVIEW_TIME_ZONE`). Kazakhstan has one zone, UTC+5, all year.
 */
export const INTERVIEW_TIME_ZONE = 'Asia/Almaty';
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
