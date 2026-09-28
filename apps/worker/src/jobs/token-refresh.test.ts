import { describe, expect, it } from 'vitest';
import { isDueForRefresh } from './token-refresh';

describe('isDueForRefresh', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const inMinutes = (m: number) => new Date(now.getTime() + m * 60_000);

  it('refreshes short-lived tokens 15 minutes before expiry', () => {
    expect(isDueForRefresh('x', inMinutes(30), now)).toBe(false);
    expect(isDueForRefresh('x', inMinutes(10), now)).toBe(true);
    expect(isDueForRefresh('youtube', inMinutes(-5), now)).toBe(true);
  });

  it('refreshes long-lived Meta tokens a week ahead', () => {
    expect(isDueForRefresh('threads', inMinutes(8 * 24 * 60), now)).toBe(false);
    expect(isDueForRefresh('threads', inMinutes(6 * 24 * 60), now)).toBe(true);
  });
});
