import Link from 'next/link';
import { cn } from '@/lib/cn';

export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn('group flex items-center gap-2.5 font-bold tracking-tight', className)}
    >
      <span className="brand-gradient relative flex size-9 items-center justify-center rounded-xl shadow-lg shadow-fuchsia-500/30 transition-transform group-hover:rotate-6 group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          className="size-5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M4 16c3-6 5-6 8 0s5 6 8 0" />
          <path d="M4 9c3-6 5-6 8 0s5 6 8 0" opacity=".55" />
        </svg>
      </span>
      <span className="text-lg">
        Mehwar<span className="brand-text">Flow</span>
      </span>
    </Link>
  );
}
