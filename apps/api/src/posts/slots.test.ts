import { describe, expect, it } from 'vitest';
import { zonedLocalToUtc } from '@mehwar/shared';
import { nextFreeSlot } from './slots';

describe('nextFreeSlot', () => {
  // 2026-01-05 is a Monday.
  const from = zonedLocalToUtc('2026-01-05T10:00', 'Asia/Dubai');

  it('returns the next slot later today or on a following day', () => {
    const slots = [
      { weekday: 1, minuteOfDay: 9 * 60 }, // Mon 09:00 (already passed)
      { weekday: 1, minuteOfDay: 18 * 60 }, // Mon 18:00
      { weekday: 3, minuteOfDay: 12 * 60 }, // Wed 12:00
    ];
    expect(nextFreeSlot(slots, 'Asia/Dubai', [], from)).toBe('2026-01-05T18:00');
  });

  it('skips slots already taken by scheduled posts', () => {
    const slots = [
      { weekday: 1, minuteOfDay: 18 * 60 },
      { weekday: 3, minuteOfDay: 12 * 60 },
    ];
    const taken = [zonedLocalToUtc('2026-01-05T18:00', 'Asia/Dubai')];
    expect(nextFreeSlot(slots, 'Asia/Dubai', taken, from)).toBe('2026-01-07T12:00');
  });

  it('returns null without slots', () => {
    expect(nextFreeSlot([], 'UTC', [], from)).toBeNull();
  });
});
