'use client';

import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { Clock, Plus, Sparkles, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PLATFORM_RULES, PLATFORMS, type Platform } from '@mehwar/shared';
import { Stagger, StaggerItem } from '@/components/motion';
import { Button, Card, Modal } from '@/components/ui';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

export interface ChannelDto {
  id: string;
  platform: Platform;
  displayName: string;
  username: string | null;
  status: 'ACTIVE' | 'NEEDS_RECONNECT' | 'DISCONNECTED';
}

/** Instagram-stories style row: connected channels get a gradient ring, others a dashed "+". */
export function StoriesRow({ channels }: { channels: ChannelDto[] }) {
  const [connecting, setConnecting] = useState<Platform | null>(null);

  return (
    <>
      <Stagger className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 pt-1">
        {PLATFORMS.map((p) => {
          const connected = channels.filter((c) => c.platform === p);
          const isOn = connected.length > 0;
          return (
            <StaggerItem key={p} className="shrink-0">
              <motion.button
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setConnecting(p)}
                className="flex w-[72px] flex-col items-center gap-2"
                aria-label={
                  isOn
                    ? `${PLATFORM_RULES[p].label} connected`
                    : `Connect ${PLATFORM_RULES[p].label}`
                }
              >
                <span
                  className="relative flex size-[68px] items-center justify-center rounded-full p-[3px]"
                  style={{ background: isOn ? PLATFORM_BRAND[p].gradient : undefined }}
                >
                  {!isOn && (
                    <motion.span
                      className="absolute inset-0 rounded-full border-2 border-dashed border-muted/50"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                  <span className="flex size-full items-center justify-center rounded-full bg-elevated ring-2 ring-[var(--bg)]">
                    <PlatformIcon platform={p} className="size-6" />
                  </span>
                  {!isOn && (
                    <span className="brand-gradient absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg)]">
                      <Plus className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center text-xs font-medium text-muted">
                  {isOn ? connected[0]!.displayName : PLATFORM_RULES[p].label}
                </span>
              </motion.button>
            </StaggerItem>
          );
        })}
      </Stagger>

      <Modal
        open={connecting !== null}
        onClose={() => setConnecting(null)}
        title={connecting ? `Connect ${PLATFORM_RULES[connecting].label}` : ''}
      >
        {connecting && (
          <div className="space-y-5 text-center">
            <motion.span
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14 }}
              className="mx-auto flex size-20 items-center justify-center rounded-3xl text-white shadow-xl"
              style={{ background: PLATFORM_BRAND[connecting].gradient }}
            >
              <PlatformIcon platform={connecting} className="size-9" />
            </motion.span>
            <p className="text-sm text-muted">
              Secure one-click connection to {PLATFORM_RULES[connecting].label} is being built right
              now. Your tokens will be encrypted and never shared.
            </p>
            <Button className="w-full" onClick={() => setConnecting(null)}>
              Notify me when it’s ready
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  accent: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setShown(value), 150);
    return () => clearTimeout(id);
  }, [value]);

  return (
    <Card whileHover={{ y: -4 }} className="relative flex items-center gap-4 overflow-hidden p-4">
      <span
        className="absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
        style={{ background: accent }}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none tabular-nums">
          <NumberFlow value={shown} />
        </p>
        <p className="mt-1 truncate text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted">{hint}</p>
      </div>
    </Card>
  );
}

export function EmptyFeed() {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <div className="relative mb-6 h-28 w-40">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="glass absolute inset-x-4 h-16 rounded-2xl bg-card-strong p-3 shadow-lg"
            style={{ top: i * 14, zIndex: 3 - i, scale: 1 - i * 0.08 }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="flex items-center gap-2">
              <span className="brand-gradient size-6 rounded-full" />
              <span className="h-2 w-16 rounded-full bg-line" />
            </div>
            <span className="mt-2 block h-2 w-24 rounded-full bg-line" />
          </motion.div>
        ))}
      </div>
      <h3 className="text-lg font-bold">Your feed is waiting for its first post</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Scheduled and published posts will show up here with their live status on every network.
      </p>
      <a
        href="#compose"
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-500 hover:underline dark:text-fuchsia-400"
      >
        <Sparkles className="size-4" /> Write your first post
      </a>
    </Card>
  );
}

export function BestTimeCard() {
  const bars = [30, 45, 60, 85, 100, 70, 40];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-fuchsia-500 dark:text-fuchsia-400" />
        <h3 className="text-sm font-bold">Best time to post</h3>
      </div>
      <div className="mt-5 flex h-28 gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <motion.div
                className="w-full rounded-lg brand-gradient"
                initial={{ height: '0%', opacity: 0.4 }}
                animate={{ height: `${h}%`, opacity: h === 100 ? 1 : 0.45 }}
                transition={{ delay: 0.4 + i * 0.07, type: 'spring', stiffness: 120, damping: 16 }}
              />
            </div>
            <span className="text-[10px] font-semibold text-muted">{days[i]}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        Personal insights unlock after your first few posts. Most audiences peak on{' '}
        <b className="text-fg">Friday evening</b>.
      </p>
    </Card>
  );
}
