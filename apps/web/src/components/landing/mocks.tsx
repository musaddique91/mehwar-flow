'use client';

/**
 * Illustrative product "screenshots" for the landing page, drawn as live UI so they follow the
 * theme. Swap any of these for real captures later by rendering an <img> inside <MockWindow>.
 */

import { motion } from 'motion/react';
import {
  CalendarDays,
  Check,
  Clock,
  Heart,
  ImagePlus,
  MessageCircle,
  Send,
  Smile,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { PLATFORM_RULES, type Platform } from '@mehwar/shared';
import { cn } from '@/lib/cn';
import { PLATFORM_BRAND, PlatformIcon } from '@/lib/platforms';

export function MockWindow({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl border border-line bg-card-strong shadow-[0_30px_80px_-30px_rgb(15_16_32/0.35)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="size-2.5 rounded-full bg-rose-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 truncate text-xs font-medium text-muted">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function NetworkDot({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg-elevated)]',
        className,
      )}
      style={{ background: PLATFORM_BRAND[platform].gradient }}
    >
      <PlatformIcon platform={platform} className="size-3.5" />
    </span>
  );
}

const QUEUE: { time: string; text: string; networks: Platform[]; status: 'scheduled' | 'sent' }[] =
  [
    {
      time: 'Today · 9:00 AM',
      text: 'Summer drop is live 🌴 Everything 20% off until Sunday.',
      networks: ['instagram', 'facebook', 'x'],
      status: 'sent',
    },
    {
      time: 'Today · 6:30 PM',
      text: 'Behind the scenes of our new studio — full tour on YouTube.',
      networks: ['youtube', 'tiktok'],
      status: 'scheduled',
    },
    {
      time: 'Tomorrow · 11:00 AM',
      text: 'We’re hiring! Three new roles on the design team.',
      networks: ['linkedin', 'threads'],
      status: 'scheduled',
    },
  ];

export function PublishMock() {
  return (
    <MockWindow title="Queue · All channels">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex -space-x-2">
          {(['instagram', 'facebook', 'x', 'youtube', 'tiktok', 'linkedin'] as Platform[]).map(
            (p) => (
              <NetworkDot key={p} platform={p} />
            ),
          )}
        </div>
        <span className="brand-gradient rounded-full px-3 py-1.5 text-xs font-semibold text-white">
          + New post
        </span>
      </div>
      <ul className="space-y-3">
        {QUEUE.map((q, i) => (
          <motion.li
            key={q.text}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.12 }}
            className="rounded-2xl border border-line bg-[var(--bg)] p-3.5"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-muted">
                <Clock className="size-3.5" /> {q.time}
              </span>
              {q.status === 'sent' ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3" /> Published
                </span>
              ) : (
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-semibold text-violet-600 dark:text-violet-300">
                  Scheduled
                </span>
              )}
            </div>
            <p className="mt-2 text-sm">{q.text}</p>
            <div className="mt-2.5 flex -space-x-1.5">
              {q.networks.map((p) => (
                <NetworkDot key={p} platform={p} className="size-6" />
              ))}
            </div>
          </motion.li>
        ))}
      </ul>
    </MockWindow>
  );
}

export function CreateMock() {
  return (
    <MockWindow title="Composer · New post">
      <div className="flex gap-1.5 overflow-hidden">
        {(['instagram', 'x', 'tiktok', 'linkedin'] as Platform[]).map((p, i) => (
          <span
            key={p}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
              i === 0 ? 'brand-gradient text-white' : 'border border-line text-muted',
            )}
          >
            <PlatformIcon platform={p} className="size-3" />
            <span className="hidden sm:inline">
              {PLATFORM_RULES[p].label}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-[var(--bg)] p-4">
        <p className="text-sm leading-relaxed">
          Golden hour never misses ✨ New collection drops Friday — which colour are you grabbing
          first?
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="aspect-square rounded-xl bg-gradient-to-br from-amber-300 to-rose-400" />
          <div className="aspect-square rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-400" />
          <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line text-muted">
            <ImagePlus className="size-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-3">
            <Smile className="size-4" /> #️⃣ <span>@</span>
          </span>
          <span>112 / 2,200</span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="mt-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3.5"
      >
        <p className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-600 dark:text-fuchsia-300">
          <Sparkles className="size-3.5" /> AI Assistant · rewrite for X
        </p>
        <p className="mt-1.5 text-sm text-muted">
          New collection. Friday. Golden-hour approved ✨ Which colour first? 👇
        </p>
      </motion.div>
    </MockWindow>
  );
}

const COMMENTS: { name: string; platform: Platform; text: string; ago: string; color: string }[] =
  [
    {
      name: 'Layla H.',
      platform: 'instagram',
      text: 'Is the green one back in stock? 😍',
      ago: '2m',
      color: 'from-rose-400 to-orange-300',
    },
    {
      name: 'Omar K.',
      platform: 'facebook',
      text: 'Do you ship to Dubai?',
      ago: '9m',
      color: 'from-sky-400 to-indigo-400',
    },
    {
      name: 'Nora',
      platform: 'youtube',
      text: 'Loved the studio tour, more of these please!',
      ago: '21m',
      color: 'from-emerald-400 to-teal-400',
    },
  ];

export function CommunityMock() {
  return (
    <MockWindow title="Comments · Inbox">
      <ul className="space-y-2">
        {COMMENTS.map((c, i) => (
          <li
            key={c.name}
            className={cn(
              'flex items-start gap-3 rounded-2xl p-3',
              i === 0 ? 'border border-violet-500/40 bg-violet-500/5' : 'border border-line',
            )}
          >
            <span className="relative">
              <span className={cn('block size-9 rounded-full bg-gradient-to-br', c.color)} />
              <NetworkDot
                platform={c.platform}
                className="absolute -bottom-1 -right-1 size-4 [&_svg]:size-2.5"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between text-sm font-semibold">
                {c.name} <span className="text-xs font-normal text-muted">{c.ago}</span>
              </p>
              <p className="text-sm text-muted">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-[var(--bg)] p-2 pl-4">
        <span className="flex-1 truncate text-sm text-muted">Yes! Restocked this morning 💚</span>
        <span className="brand-gradient flex size-9 items-center justify-center rounded-xl text-white">
          <Send className="size-4" />
        </span>
      </div>
    </MockWindow>
  );
}

const BARS = [38, 52, 44, 67, 58, 81, 74, 92, 70, 88, 96, 110];

export function InsightsMock() {
  const max = Math.max(...BARS);
  return (
    <MockWindow title="Analytics · Last 30 days">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Impressions', value: '184K', icon: TrendingUp },
          { label: 'Engagement', value: '12.4K', icon: Heart },
          { label: 'Followers', value: '+2,318', icon: Users },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-[var(--bg)] p-3">
            <k.icon className="size-4 text-muted" />
            <p className="mt-2 text-lg font-black tracking-tight sm:text-xl">{k.value}</p>
            <p className="text-[11px] text-muted">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-[var(--bg)] p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">Engagement</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">▲ 24%</span>
        </div>
        <div className="mt-4 flex h-32 items-end gap-1.5">
          {BARS.map((b, i) => (
            <motion.span
              key={i}
              initial={{ height: 0 }}
              whileInView={{ height: `${(b / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * i, duration: 0.6, ease: 'easeOut' }}
              className={cn(
                'flex-1 rounded-t-md',
                i === BARS.length - 1 ? 'brand-gradient' : 'bg-violet-500/30',
              )}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line p-3 text-sm">
        <MessageCircle className="size-4 shrink-0 text-fuchsia-500" />
        <span className="text-muted">
          <b className="text-fg">Best time to post:</b> Thursdays, 6–8 PM
        </span>
      </div>
    </MockWindow>
  );
}

export function CalendarMini() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const filled: Record<number, Platform> = {
    1: 'instagram',
    3: 'x',
    4: 'tiktok',
    8: 'linkedin',
    10: 'youtube',
    12: 'facebook',
    15: 'threads',
    17: 'instagram',
    19: 'x',
  };
  return (
    <div className="rounded-2xl border border-line bg-[var(--bg)] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <CalendarDays className="size-3.5" /> October
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
        {days.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {Array.from({ length: 21 }, (_, i) => (
          <span
            key={i}
            className="flex aspect-square items-center justify-center rounded-md border border-line"
          >
            {filled[i] ? (
              <span
                className="size-2 rounded-full"
                style={{ background: PLATFORM_BRAND[filled[i]].gradient }}
              />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
