import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a wall-clock time the user picked ("2026-03-29T09:00" in "Europe/London") into the
 * UTC instant stored by the scheduler. DST gaps resolve forward, like most calendar apps.
 */
export function zonedLocalToUtc(localDateTime: string, timeZone: string): Date {
  if (!isValidTimeZone(timeZone)) throw new RangeError(`Unknown time zone: ${timeZone}`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(localDateTime)) {
    throw new RangeError('Expected local date-time in the form YYYY-MM-DDTHH:mm');
  }
  const date = fromZonedTime(localDateTime, timeZone);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
  return date;
}

/** Formats a UTC instant as local wall-clock time ("YYYY-MM-DDTHH:mm") in the given zone. */
export function utcToZonedLocal(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd'T'HH:mm");
}
