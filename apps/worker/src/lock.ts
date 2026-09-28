import { randomUUID } from 'node:crypto';
import type IORedis from 'ioredis';
import { RetryableError } from '@mehwar/connectors';

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/**
 * Redis mutex: serializes work per channel (one publish or token refresh at a time), which also
 * keeps us inside per-account platform rate limits.
 */
export async function withLock<T>(
  redis: IORedis,
  key: string,
  fn: () => Promise<T>,
  { ttlMs = 15 * 60_000, waitMs = 60_000 } = {},
): Promise<T> {
  const token = randomUUID();
  const deadline = Date.now() + waitMs;
  while (!(await redis.set(key, token, 'PX', ttlMs, 'NX'))) {
    if (Date.now() > deadline) throw new RetryableError(`Busy: ${key}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE, 1, key, token);
  }
}
