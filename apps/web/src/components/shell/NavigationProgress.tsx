'use client';

import { Loader2 } from 'lucide-react';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const NAV_START = 'mf:nav-start';

/** Call before a programmatic `router.push` so the progress bar shows immediately. */
export function startNavigation() {
  window.dispatchEvent(new Event(NAV_START));
}

/** True for a plain left click on an in-app link that leads to a different page. */
function isInternalNavigation(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return false;
  }
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page (or just a #hash on it): Next won't navigate, so nothing to wait for.
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

/**
 * A thin animated bar at the top of the window from the moment a link is clicked until the new
 * page has rendered, so a click never looks ignored while the next page loads.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const start = () => setActive(true);
    const onClick = (e: MouseEvent) => isInternalNavigation(e) && start();
    window.addEventListener(NAV_START, start);
    // Capture phase: runs before Next's Link handler, so the bar appears on the same frame.
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener(NAV_START, start);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  // The new route rendered: done.
  useEffect(() => setActive(false), [pathname]);

  // Never get stuck (a failed or cancelled navigation keeps the same pathname).
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 15_000);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-200',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      {active && <div className="brand-gradient animate-nav-progress h-full w-1/3 rounded-full" />}
    </div>
  );
}

/** Spinner shown inside a menu <Link> while its navigation is pending. */
export function LinkPendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 className={cn('size-3.5 shrink-0 animate-spin text-fuchsia-500', className)} />;
}
