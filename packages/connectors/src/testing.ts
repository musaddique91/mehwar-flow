import { vi } from 'vitest';
import type { ConnectorContext, MediaRef } from './types';

export interface RecordedCall {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (
  call: RecordedCall,
) => { status?: number; json?: unknown; text?: string; headers?: Record<string, string> } | Error;

/**
 * Fake fetch router: the first route whose `METHOD url-substring` key matches handles the call.
 * Routes can be arrays to return different responses on successive calls.
 */
export function fakeContext(routes: Record<string, Handler | Handler[]>) {
  const calls: RecordedCall[] = [];
  const counters = new Map<string, number>();
  let clock = Date.parse('2026-01-01T00:00:00Z');

  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = Object.fromEntries(
      Object.entries((init?.headers as Record<string, string>) ?? {}),
    );
    let body: unknown = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = Object.fromEntries(new URLSearchParams(body as string));
      }
    }
    const call = { method, url, headers, body };
    calls.push(call);
    const key = Object.keys(routes).find((k) => {
      const [m, ...rest] = k.split(' ');
      return m === method && url.includes(rest.join(' '));
    });
    if (!key) throw new Error(`Unexpected request: ${method} ${url}`);
    const route = routes[key]!;
    const n = counters.get(key) ?? 0;
    counters.set(key, n + 1);
    const handler = Array.isArray(route) ? route[Math.min(n, route.length - 1)]! : route;
    const result = handler(call);
    if (result instanceof Error) throw result;
    const text = result.text ?? (result.json === undefined ? '' : JSON.stringify(result.json));
    return new Response(result.status === 204 ? null : text, {
      status: result.status ?? 200,
      headers: result.headers,
    });
  });

  const ctx: ConnectorContext = {
    fetch: fetchImpl as unknown as typeof fetch,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  };
  return { ctx, calls };
}

export function fakeMedia(
  kind: 'image' | 'video',
  size = 1024,
  extra: Partial<MediaRef> = {},
): MediaRef {
  const data = Buffer.alloc(size, kind === 'image' ? 1 : 2);
  return {
    kind,
    mimeType: kind === 'image' ? 'image/jpeg' : 'video/mp4',
    sizeBytes: size,
    width: 1080,
    height: 1920,
    durationSec: kind === 'video' ? 30 : null,
    publicUrl: `https://media.example.com/public/${kind}.${kind === 'image' ? 'jpg' : 'mp4'}`,
    read: async (range) => (range ? data.subarray(range.start, range.end + 1) : data),
    ...extra,
  };
}
