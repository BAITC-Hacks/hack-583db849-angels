import { cookies } from 'next/headers';
import { readStaffLocale, STAFF_LOCALE_COOKIE, type Copy, type StaffLocale } from './staffLocale';

/** The staff language for this request, read on the server so the first paint is already right. */
export async function getStaffLocale(): Promise<StaffLocale> {
  return readStaffLocale((await cookies()).get(STAFF_LOCALE_COOKIE)?.value);
}

export async function getCopy<T>(copy: Copy<T>): Promise<T> {
  return copy[await getStaffLocale()];
}
