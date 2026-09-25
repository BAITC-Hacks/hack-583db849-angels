export type SurpriseStatus = 'ready' | 'started' | 'transcribing' | 'answered' | 'expired' | 'failed';

/** Reading time between `start` and the camera, then the answer itself: the deadline is both. */
export const READING_SECONDS = 10;
/** An upload that began in time may land a little after the deadline. */
export const UPLOAD_GRACE_SECONDS = 15;

/**
 * The status as of `now`. A question opened and never answered expires by
 * itself at the deadline plus the grace, without anything having to run.
 */
export function surpriseStatus(row: { status: string; answerDeadline: Date | null }, now = new Date()): SurpriseStatus {
  if (row.status === 'started' && row.answerDeadline && now.getTime() > row.answerDeadline.getTime() + UPLOAD_GRACE_SECONDS * 1000) {
    return 'expired';
  }
  return row.status as SurpriseStatus;
}
