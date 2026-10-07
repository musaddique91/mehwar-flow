'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveEvent } from '@mehwar/shared';
import { api } from './api';

export type Topic =
  | 'posts'
  | 'channels'
  | 'media'
  | 'notifications'
  | 'slots'
  | 'billing'
  | 'analytics'
  | 'comments'
  | 'ai'
  | 'customers'
  | 'customer-groups'
  | 'whatsapp'
  | 'schedulers'
  | 'automation';

const TOPIC_EVENT = 'mf:refresh';
const LIVE_EVENT = 'mf:live';

export function invalidate(...topics: Topic[]) {
  window.dispatchEvent(new CustomEvent(TOPIC_EVENT, { detail: topics }));
}

export function emitLive(event: LiveEvent) {
  window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: event }));
}

export function useLiveEvent(handler: (event: LiveEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const listener = (e: Event) => ref.current((e as CustomEvent<LiveEvent>).detail);
    window.addEventListener(LIVE_EVENT, listener);
    return () => window.removeEventListener(LIVE_EVENT, listener);
  }, []);
}

/**
 * Last good response per path, shared by every component. Pages render instantly from it when the
 * user navigates back, then revalidate in the background (stale-while-revalidate).
 */
const cache = new Map<string, unknown>();
/** Requests currently on the wire, so components asking for the same path share one fetch. */
const inflight = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  let p = inflight.get(path) as Promise<T> | undefined;
  if (!p) {
    p = api<T>(path)
      .then((result) => {
        cache.set(path, result);
        return result;
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

/** Warms the cache for `path` (e.g. on menu hover) so the page opens with data already there. */
export function prefetchApi(path: string) {
  if (!cache.has(path)) void load(path).catch(() => undefined);
}

/** Drops cached data (on logout, so the next user never sees it). */
export function clearApiCache() {
  cache.clear();
}

/**
 * Minimal data hook: loads `path`, refetches when any of `topics` is invalidated, and keeps the
 * previous data while refetching (no flicker). Cached data is shown immediately on mount.
 */
export function useApi<T>(path: string | null, topics: Topic[] = []) {
  const [data, setData] = useState<T | undefined>(() =>
    path === null ? undefined : (cache.get(path) as T | undefined),
  );
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(path !== null && !cache.has(path));
  const seq = useRef(0);

  const refetch = useCallback(async () => {
    if (path === null) return;
    const id = ++seq.current;
    if (cache.has(path)) setData(cache.get(path) as T);
    setLoading(true);
    try {
      const result = await load<T>(path);
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === seq.current) setError(err as Error);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const topicKey = topics.join(',');
  useEffect(() => {
    if (!topicKey) return;
    const wanted = topicKey.split(',');
    const listener = (e: Event) => {
      if ((e as CustomEvent<Topic[]>).detail.some((t) => wanted.includes(t))) {
        // Invalidation means the cached copy is stale for everyone, not just this component.
        if (path !== null) cache.delete(path);
        void refetch();
      }
    };
    window.addEventListener(TOPIC_EVENT, listener);
    return () => window.removeEventListener(TOPIC_EVENT, listener);
  }, [topicKey, refetch, path]);

  // Callers that patch data optimistically keep the shared cache in step.
  const setDataCached = useCallback(
    (next: T | undefined | ((prev: T | undefined) => T | undefined)) => {
      setData((prev) => {
        const value =
          typeof next === 'function' ? (next as (p: T | undefined) => T | undefined)(prev) : next;
        if (path !== null) {
          if (value === undefined) cache.delete(path);
          else cache.set(path, value);
        }
        return value;
      });
    },
    [path],
  );

  return { data, error, loading, refetch, setData: setDataCached };
}
