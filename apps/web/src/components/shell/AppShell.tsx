'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  CalendarDays,
  ChartNoAxesColumn,
  House,
  Images,
  KeyRound,
  LogOut,
  MessageSquare,
  Plug,
  Settings,
  ShieldCheck,
  SquarePen,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { NotificationDto } from '@mehwar/shared';
import { PrivacyModal } from '@/components/modals/PrivacyModal';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { SecurityModal } from '@/components/modals/SecurityModal';
import { GradientBlobs } from '@/components/motion';
import { Avatar } from '@/components/ui';
import { Logo } from '@/components/ui/Logo';
import { Wordmark } from '@/components/ui/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useLiveEvents } from '@/lib/events';
import { invalidate, useApi } from '@/lib/hooks';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/channels', label: 'Channels', icon: Plug },
  { href: '/comments', label: 'Comments', icon: MessageSquare },
  { href: '/media', label: 'Media', icon: Images },
  { href: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn },
  { href: '/users', label: 'User Management', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onOutside();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);
  return ref;
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-2 p-4 md:flex">
      <div className="px-2 py-3">
        <Logo href="/dashboard" />
      </div>
      <nav className="mt-4 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-colors',
                active ? 'text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-pill"
                  className="absolute inset-0 rounded-2xl bg-card-strong shadow-sm ring-1 ring-line"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <item.icon
                className={cn(
                  'relative size-5',
                  active && 'text-fuchsia-500 dark:text-fuchsia-400',
                )}
              />
              <span className="relative flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <Link
        href="/dashboard#compose"
        className="brand-gradient mt-4 flex h-12 items-center justify-center gap-2 rounded-full font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:-translate-y-0.5 hover:shadow-fuchsia-500/50"
      >
        <SquarePen className="size-4" /> Create post
      </Link>
      <div className="mt-auto space-y-2">
        <UserMenu />
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted">
          <span className="opacity-70">Powered by</span>
          <Wordmark height={14} />
        </div>
      </div>
    </aside>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  if (!user) return null;
  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl text-left transition hover:bg-line',
            compact ? 'p-1' : 'p-2',
          )}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Avatar name={user.name} size={compact ? 36 : 40} />
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-muted">{user.email}</span>
            </span>
          )}
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: compact ? -8 : 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: compact ? -8 : 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'glass absolute z-50 w-60 rounded-2xl bg-card-strong p-1.5 shadow-2xl border border-line',
                compact ? 'right-0 top-12' : 'bottom-16 left-0',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-line text-fg transition"
              >
                <User className="size-4 text-fuchsia-500" /> Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSecurityOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-line text-fg transition"
              >
                <KeyRound className="size-4 text-primary" /> Security & Password
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPrivacyOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-line text-fg transition"
              >
                <ShieldCheck className="size-4 text-emerald-500" /> Privacy & Data
              </button>

              <div className="my-1 border-t border-line/60" />

              <button
                type="button"
                onClick={async () => {
                  await logout();
                  toast('See you soon 👋');
                  router.replace('/login');
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition"
              >
                <LogOut className="size-4" /> Log out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SecurityModal open={securityOpen} onClose={() => setSecurityOpen(false)} />
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  );
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const { data } = useApi<{ items: NotificationDto[]; unread: number }>('/notifications', [
    'notifications',
  ]);
  const unread = data?.unread ?? 0;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api('/notifications/read', { method: 'POST' }).catch(() => undefined);
      setTimeout(() => invalidate('notifications'), 1500);
    }
  };

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={toggle}
        className="glass relative flex size-10 items-center justify-center rounded-full"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <motion.span
          key={unread}
          animate={unread ? { rotate: [0, -15, 12, -8, 0] } : {}}
          transition={{ duration: 0.6 }}
        >
          <Bell className="size-4" />
        </motion.span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="brand-gradient absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-[var(--bg)]"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            className="glass absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-card-strong shadow-2xl"
          >
            <p className="border-b border-line px-4 py-3 text-sm font-bold">Notifications</p>
            <div className="max-h-96 overflow-y-auto">
              {!data?.items.length ? (
                <p className="px-4 py-8 text-center text-sm text-muted">You’re all caught up ✨</p>
              ) : (
                data.items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (n.link) router.push(n.link);
                    }}
                    className={cn(
                      'flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-line/60',
                      !n.readAt && 'bg-fuchsia-500/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        n.readAt ? 'bg-transparent' : 'brand-gradient',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{n.title}</span>
                      {n.body && (
                        <span className="line-clamp-2 block text-xs text-muted">{n.body}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Topbar() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="md:hidden">
        <Logo href="/dashboard" />
      </div>
      <div className="hidden md:block">
        <p className="text-sm text-muted" suppressHydrationWarning>{greeting},</p>
        <p className="text-xl font-bold tracking-tight" suppressHydrationWarning>{user?.name.split(' ')[0] ?? 'there'} 👋</p>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsBell />
        <ThemeToggle />
        <div className="md:hidden">
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  const items: NavItem[] = [
    NAV[0]!,
    NAV[1]!,
    { href: '/dashboard#compose', label: 'Create', icon: SquarePen },
    NAV[4]!,
    NAV[2]!,
  ];
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full bg-card-strong px-2 py-2 shadow-2xl md:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        const isCreate = item.label === 'Create';
        return (
          <Link key={item.href} href={item.href} aria-label={item.label}>
            <motion.span whileTap={{ scale: 0.85 }} className="block">
              {isCreate ? (
                <span className="brand-gradient flex size-12 items-center justify-center rounded-full text-white shadow-lg shadow-fuchsia-500/40">
                  <item.icon className="size-5" />
                </span>
              ) : (
                <span className="relative flex size-11 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-full bg-line"
                    />
                  )}
                  <item.icon
                    className={cn(
                      'relative size-5',
                      active ? 'text-fuchsia-500 dark:text-fuchsia-400' : 'text-muted',
                    )}
                  />
                </span>
              )}
            </motion.span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  useLiveEvents(Boolean(user));
  return (
    <div className="relative flex min-h-dvh">
      <GradientBlobs />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col md:border-l md:border-line">
        <Topbar />
        <main className="flex-1 px-4 pb-28 md:px-8 md:pb-10">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
