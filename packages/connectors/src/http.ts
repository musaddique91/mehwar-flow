import { AuthError, PermanentError, RetryableError } from './errors';
import type { ConnectorContext } from './types';

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  json?: unknown;
  form?: Record<string, string | undefined>;
  body?: RequestInit['body'];
  bearer?: string;
  /** Return the raw Response instead of parsing JSON (for resumable uploads). */
  raw?: boolean;
  /** Extra statuses that are not errors (e.g. 308 for resumable uploads). */
  okStatuses?: number[];
}

export function withQuery(url: string, query?: RequestOptions['query']): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  return u.toString();
}

export async function request<T = any>(
  ctx: ConnectorContext,
  url: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  let body: RequestInit['body'] | undefined = opts.body;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.form)) if (v !== undefined) params.set(k, v);
    body = params.toString();
  }
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;

  let res: Response;
  try {
    res = await ctx.fetch(withQuery(url, opts.query), {
      method: opts.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
    });
  } catch (err) {
    throw new RetryableError(`Network error: ${(err as Error).message}`);
  }

  if (opts.raw && (res.ok || opts.okStatuses?.includes(res.status))) return res as T;
  if (!res.ok && !opts.okStatuses?.includes(res.status)) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

/** Maps an HTTP error response (incl. Meta/Google/TikTok/X error shapes) to our error classes. */
export async function toError(res: Response): Promise<Error> {
  const text = await res.text().catch(() => '');
  let body: any = undefined;
  try {
    body = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  const message =
    extractMessage(body) ?? (text.slice(0, 300) || res.statusText || `HTTP ${res.status}`);
  const retryAfter = Number(res.headers.get('retry-after'));
  const retryAfterMs =
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined;

  const metaCode = body?.error?.code;
  const oauthError = typeof body?.error === 'string' ? body.error : undefined;
  if (
    res.status === 401 ||
    metaCode === 190 ||
    oauthError === 'invalid_grant' ||
    oauthError === 'invalid_token'
  ) {
    return new AuthError(message);
  }
  if (body?.error?.is_transient || [4, 17, 32, 613].includes(metaCode))
    return new RetryableError(message, retryAfterMs);
  if (res.status === 429 || res.status >= 500) return new RetryableError(message, retryAfterMs);
  return new PermanentError(message);
}

function extractMessage(body: any): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  if (typeof body.error === 'object' && body.error?.message) return String(body.error.message);
  if (typeof body.error_description === 'string') return body.error_description;
  if (typeof body.error === 'string') return body.error;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.errors) && body.errors[0])
    return body.errors[0].message ?? body.errors[0].detail;
  if (typeof body.message === 'string') return body.message;
  return undefined;
}

export function expiresIn(
  ctx: ConnectorContext,
  seconds: number | string | undefined | null,
): Date | null {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(ctx.now() + n * 1000) : null;
}

/** Polls `check` with backoff until it returns a value, or throws RetryableError on timeout. */
export async function poll<T>(
  ctx: ConnectorContext,
  check: () => Promise<T | undefined>,
  { intervalMs = 3000, timeoutMs = 5 * 60_000, what = 'processing' } = {},
): Promise<T> {
  const deadline = ctx.now() + timeoutMs;
  let delay = intervalMs;
  for (;;) {
    const result = await check();
    if (result !== undefined) return result;
    if (ctx.now() + delay > deadline) throw new RetryableError(`Timed out waiting for ${what}`);
    await ctx.sleep(delay);
    delay = Math.min(delay * 1.5, 30_000);
  }
}
