/**
 * Dates as the interface prints them: English, with the month written out.
 *
 * Named once here so a screen cannot print a date one way and its neighbour
 * another.
 */
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'long' });
const dateTimeFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(value: string | Date): string {
  return dateFormat.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormat.format(new Date(value));
}
