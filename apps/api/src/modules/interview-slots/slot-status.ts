/** The door to the call opens this long before the start. */
export const JOIN_OPENS_MINUTES = 10;
/** Each side waits this long after the start; then the slot is missed. */
export const WAIT_MINUTES = 5;
/** A call that took place can be rejoined, after a dropped connection, until this long after its end. */
export const REJOIN_MINUTES_AFTER_END = 30;

const MINUTE = 60_000;

export type SlotStatus = 'open' | 'closed' | 'booked' | 'waiting' | 'live' | 'done' | 'missed';
export type MissedBy = 'candidate' | 'interviewer' | 'both';

export interface SlotTimes {
  startsAt: Date;
  durationMin: number;
  candidateId: string | null;
  candidateJoinedAt: Date | null;
  interviewerJoinedAt: Date | null;
}

const after = (date: Date, minutes: number) => new Date(date.getTime() + minutes * MINUTE);

export const endsAt = (slot: SlotTimes) => after(slot.startsAt, slot.durationMin);
export const waitUntil = (slot: SlotTimes) => after(slot.startsAt, WAIT_MINUTES);
export const opensAt = (slot: SlotTimes) => after(slot.startsAt, -JOIN_OPENS_MINUTES);
export const rejoinUntil = (slot: SlotTimes) => after(endsAt(slot), REJOIN_MINUTES_AFTER_END);

/**
 * Where a slot is, worked out from its times alone, so nothing has to run
 * when a slot is missed: the first read after `waitUntil` sees it.
 */
export function slotStatus(slot: SlotTimes, now = new Date()): SlotStatus {
  const time = now.getTime();
  if (!slot.candidateId) return time < slot.startsAt.getTime() ? 'open' : 'closed';
  if (slot.candidateJoinedAt && slot.interviewerJoinedAt) return time < endsAt(slot).getTime() ? 'live' : 'done';
  if (time < slot.startsAt.getTime()) return 'booked';
  if (time < waitUntil(slot).getTime()) return 'waiting';
  return 'missed';
}

/** Who did not come, once a slot is missed. */
export function missedBy(slot: SlotTimes, now = new Date()): MissedBy | null {
  if (slotStatus(slot, now) !== 'missed') return null;
  if (!slot.candidateJoinedAt && !slot.interviewerJoinedAt) return 'both';
  return slot.candidateJoinedAt ? 'interviewer' : 'candidate';
}

/** The calendar day of a moment, `YYYY-MM-DD`, in the admissions office's time zone. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
