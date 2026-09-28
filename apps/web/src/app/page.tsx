import Link from 'next/link';
import { PLATFORM_RULES, PLATFORMS } from '@mehwar/shared';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Mehwar Flow</h1>
      <p className="max-w-xl text-lg text-slate-600 dark:text-slate-400">
        Write once, preview everywhere, schedule and publish to all your social channels from one
        dashboard.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {PLATFORMS.map((p) => (
          <span
            key={p}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
          >
            {PLATFORM_RULES[p].label}
          </span>
        ))}
      </div>
      <div className="flex gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
