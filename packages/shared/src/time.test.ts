import { describe, expect, it } from 'vitest';
import { utcToZonedLocal, zonedLocalToUtc } from './time';

describe('time zone mapping', () => {
  it('maps local time to UTC', () => {
    expect(zonedLocalToUtc('2026-01-15T09:00', 'Asia/Karachi').toISOString()).toBe(
      '2026-01-15T04:00:00.000Z',
    );
    expect(zonedLocalToUtc('2026-01-15T09:00', 'America/New_York').toISOString()).toBe(
      '2026-01-15T14:00:00.000Z',
    );
  });

  it('handles DST changes', () => {
    // New York: EDT (UTC-4) in July vs EST (UTC-5) in January.
    expect(zonedLocalToUtc('2026-07-15T09:00', 'America/New_York').toISOString()).toBe(
      '2026-07-15T13:00:00.000Z',
    );
    // London springs forward on 2026-03-29 at 01:00 -> 02:00.
    expect(zonedLocalToUtc('2026-03-29T00:30', 'Europe/London').toISOString()).toBe(
      '2026-03-29T00:30:00.000Z',
    );
    expect(zonedLocalToUtc('2026-03-29T03:00', 'Europe/London').toISOString()).toBe(
      '2026-03-29T02:00:00.000Z',
    );
  });

  it('round-trips', () => {
    const utc = zonedLocalToUtc('2026-11-01T18:45', 'Asia/Dubai');
    expect(utcToZonedLocal(utc, 'Asia/Dubai')).toBe('2026-11-01T18:45');
  });

  it('rejects unknown zones and malformed input', () => {
    expect(() => zonedLocalToUtc('2026-01-01T10:00', 'Mars/Olympus')).toThrow(RangeError);
    expect(() => zonedLocalToUtc('tomorrow', 'UTC')).toThrow(RangeError);
  });
});
