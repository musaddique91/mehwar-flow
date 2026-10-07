import { Loader2 } from 'lucide-react';

/**
 * Shown in the content area the instant a menu item is clicked, while the next page's code and
 * data load (Next renders it as the route's Suspense fallback).
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 pt-2" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Loader2 className="size-4 animate-spin text-fuchsia-500" />
        Loading…
      </div>
      <div className="h-8 w-56 animate-pulse rounded-xl bg-line/70" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-line/60" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-3xl bg-line/50" />
        ))}
      </div>
    </div>
  );
}
