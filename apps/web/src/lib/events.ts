'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import type { LiveEvent } from '@mehwar/shared';
import { authFetch } from './api';
import { emitLive, invalidate } from './hooks';

/**
 * Keeps one server-sent-events connection open while the app is mounted. EventSource can't send
 * the Bearer header, so the stream is read with fetch. Reconnects with backoff.
 */
export function useLiveEvents(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let attempt = 0;

    const handle = (event: LiveEvent) => {
      emitLive(event);
      switch (event.type) {
        case 'post.updated':
          invalidate('posts');
          break;
        case 'media.updated':
          invalidate('media');
          break;
        case 'channel.updated':
          invalidate('channels');
          break;
        case 'notification':
          invalidate('notifications', 'channels');
          toast(event.title, { description: event.body ?? undefined });
          break;
      }
    };

    const connect = async () => {
      while (!stopped) {
        controller = new AbortController();
        try {
          const res = await authFetch('/events', {
            signal: controller.signal,
            headers: { Accept: 'text/event-stream' },
          });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          attempt = 0;
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            let idx: number;
            while ((idx = buffer.indexOf('\n\n')) >= 0) {
              const chunk = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              const data = chunk
                .split('\n')
                .filter((l) => l.startsWith('data: '))
                .map((l) => l.slice(6))
                .join('\n');
              if (data) {
                try {
                  handle(JSON.parse(data) as LiveEvent);
                } catch {
                  /* ignore malformed */
                }
              }
            }
          }
        } catch {
          if (stopped) return;
        }
        attempt++;
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt)));
      }
    };
    void connect();
    return () => {
      stopped = true;
      controller?.abort();
    };
  }, [enabled]);
}
