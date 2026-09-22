/**
 * Interface language for interviewer, commission and admin screens.
 *
 * Candidate screens and the stand are English only and never read this. A
 * candidate's quote is never translated, whatever the choice here: evidence is
 * checked word for word against its source.
 */
export type StaffLocale = 'en' | 'ru';

export const STAFF_LOCALE_COOKIE = 'invision-staff-locale';

export function readStaffLocale(value: string | undefined): StaffLocale {
  return value === 'ru' ? 'ru' : 'en';
}

/** Text that exists in both staff languages. TypeScript refuses one that is missing a translation. */
export type Copy<T> = Record<StaffLocale, T>;
