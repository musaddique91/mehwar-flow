import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  CanActivate,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config';

const WINDOW_MS = 60_000;

/**
 * Stricter per-IP limit for credential endpoints (brute-force protection), on top of the global
 * throttler. In-memory for now; moves to Redis when the API runs as multiple replicas.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size > 10_000) this.prune(now);
      this.hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }
    entry.count++;
    if (entry.count > this.config.AUTH_RATE_LIMIT_PER_MINUTE) {
      throw new HttpException(
        'Too many attempts, try again in a minute',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
