import type { ReactNode } from 'react';

/**
 * Re-mounts on every navigation inside the app. A short opacity-only CSS fade: blurring or
 * spring-animating the whole page made every menu click feel sluggish.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
