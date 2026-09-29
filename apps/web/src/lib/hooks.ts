'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveEvent } from '@mehwar/shared';
import { api } from './api';

/** Topics that pages can refetch on. Mutations and live events publish them. */
export type Topic = 'posts' | 'channels' | 'media' | 'notifications' | 'slots' | 'billing';

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
 * Minimal data hook: loads `path`, refetches when any of `topics` is invalidated, and keeps the
 * previous data while refetching (no flicker).
 */
export function useApi<T>(path: string | null, topics: Topic[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const seq = useRef(0);

  const refetch = useCallback(async () => {
    if (path === null) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
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
      if ((e as CustomEvent<Topic[]>).detail.some((t) => wanted.includes(t))) void refetch();
    };
    window.addEventListener(TOPIC_EVENT, listener);
    return () => window.removeEventListener(TOPIC_EVENT, listener);
  }, [topicKey, refetch]);

  return { data, error, loading, refetch, setData };
}
