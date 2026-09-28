import { formatInTimeZone } from 'date-fns-tz';
import { zonedLocalToUtc } from '@mehwar/shared';

export interface Slot {
  weekday: number;
  minuteOfDay: number;
}

/**
 * Finds the next weekly slot (in the user's time zone) after `from` whose minute is not already
 * taken by a scheduled post. Looks up to 8 weeks ahead.
 */
export function nextFreeSlot(
  slots: Slot[],
  timezone: string,
  taken: Date[],
  from = new Date(),
): string | null {
  if (slots.length === 0) return null;
  const takenMinutes = new Set(taken.map((d) => Math.floor(d.getTime() / 60_000)));
  const sorted = [...slots].sort((a, b) => a.minuteOfDay - b.minuteOfDay);
  for (let day = 0; day < 56; day++) {
    const probe = new Date(from.getTime() + day * 86_400_000);
    const localDate = formatInTimeZone(probe, timezone, 'yyyy-MM-dd');
    const weekday =
      Number(formatInTimeZone(zonedLocalToUtc(`${localDate}T12:00`, timezone), timezone, 'i')) % 7;
    for (const slot of sorted.filter((s) => s.weekday === weekday)) {
      const hh = String(Math.floor(slot.minuteOfDay / 60)).padStart(2, '0');
      const mm = String(slot.minuteOfDay % 60).padStart(2, '0');
      const local = `${localDate}T${hh}:${mm}`;
      const utc = zonedLocalToUtc(local, timezone);
      if (utc.getTime() <= from.getTime() + 60_000) continue;
      if (!takenMinutes.has(Math.floor(utc.getTime() / 60_000))) return local;
    }
  }
  return null;
}
