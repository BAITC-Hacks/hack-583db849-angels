import type { components } from '@invision/api-client';

export type InterviewSlot = components['schemas']['InterviewSlotDto'];
export type SlotStatus = InterviewSlot['status'];
export type CallAccess = components['schemas']['CallAccessDto'];

/** The side of the call a slot has not been joined from, once it is missed. */
export type MissedBy = NonNullable<InterviewSlot['missedBy']>;

/** A slot someone can still go into: booked and not missed, over or closed. */
export function isComing(status: SlotStatus): boolean {
  return status === 'booked' || status === 'waiting' || status === 'live';
}
