'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Bot,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronLeft,
  ChevronRight,
  House,
  Images,
  KeyRound,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  SquarePen,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
import { invalidate, prefetchApi, useApi } from '@/lib/hooks';
import { LinkPendingSpinner, NavigationProgress, startNavigation } from './NavigationProgress';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** API paths the page loads first; fetched on hover so the page opens with data. */
  preload?: string[];
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Publish',
    items: [
      {
        href: '/dashboard',
        label: 'Home',
        icon: House,
        preload: ['/channels', '/posts?limit=50', '/analytics/summary?days=30'],
      },
      {
        href: '/schedules',
        label: 'My Schedules',
        icon: CalendarClock,
        preload: ['/posts?limit=300', '/channels', '/slots'],
      },
      { href: '/calendar', label: 'Calendar', icon: CalendarDays, preload: ['/slots'] },
    ],
  },
  {
    label: 'Engage',
    items: [
      { href: '/comments', label: 'Comments', icon: MessageSquare },
      {
        href: '/users',
        label: 'Customers',
        icon: Users,
        preload: ['/customers', '/customers/groups', '/whatsapp/status'],
      },
      { href: '/automation', label: 'Automation', icon: Bot, preload: ['/automation/runs'] },
    ],
  },
  {
    label: 'Library',
    items: [
      { href: '/channels', label: 'Channels', icon: Plug, preload: ['/channels'] },
      { href: '/media', label: 'Media', icon: Images, preload: ['/media'] },
      {
        href: '/analytics',
        label: 'Analytics',
        icon: ChartNoAxesColumn,
        preload: ['/analytics/summary?days=30'],
      },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/notifications', label: 'Notifications', icon: Bell, preload: ['/notifications'] },
      { href: '/settings', label: 'Settings', icon: Settings, preload: ['/billing', '/channels'] },
    ],
  },
];

function isActive(pathname: string, href: string) {
  // A post's detail page is reached from the Home feed.
  if (href === '/dashboard' && pathname.startsWith('/posts/')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  const { data: notifData } = useApi<{ unread: number }>('/notifications', ['notifications']);
  const unreadCount = notifData?.unread ?? 0;

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col p-3 md:flex">
      <div className="px-2.5 py-1.5">
        <Logo href="/dashboard" />
      </div>
      <Link
        href="/dashboard#compose"
        className="brand-gradient mt-3 flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:shadow-fuchsia-500/40"
      >
        <SquarePen className="size-4" /> Create post
      </Link>
      <nav className="no-scrollbar mt-4 flex flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/70">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const badge = item.href === '/notifications' ? unreadCount : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => item.preload?.forEach(prefetchApi)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-card-strong text-fg shadow-xs ring-1 ring-line'
                        : 'text-muted hover:bg-card/50 hover:text-fg',
                    )}
                  >
                    {active && (
                      <span className="brand-gradient absolute inset-y-2 left-0 w-1 rounded-r-full" />
                    )}
                    <item.icon
                      className={cn(
                        'size-[18px]',
                        active ? 'text-fuchsia-500 dark:text-fuchsia-400' : 'text-muted/80',
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    <LinkPendingSpinner />
                    {badge > 0 && (
                      <span className="brand-gradient flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto space-y-1 border-t border-line/60 pt-2">
        <UserMenu />
        <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-muted">
          <span className="opacity-70">Powered by</span>
          <Wordmark height={13} />
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
            'flex w-full items-center gap-2.5 rounded-xl text-left transition hover:bg-line/60',
            compact ? 'p-1' : 'p-1.5',
          )}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Avatar name={user.name} size={compact ? 32 : 36} />
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">{user.name}</span>
              <span className="block truncate text-xs text-muted leading-tight">{user.email}</span>
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
                'glass absolute z-50 w-56 rounded-2xl bg-card-strong p-1 shadow-2xl border border-line',
                compact ? 'right-0 top-12' : 'bottom-14 left-0',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium hover:bg-line text-fg transition"
              >
                <User className="size-4 text-fuchsia-500" /> Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSecurityOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium hover:bg-line text-fg transition"
              >
                <KeyRound className="size-4 text-primary" /> Security & Password
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPrivacyOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium hover:bg-line text-fg transition"
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
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition"
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
            className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl bg-white dark:bg-[#0e0e1a] shadow-2xl border border-line sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-84 sm:max-w-[calc(100vw-2rem)] text-fg"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-white dark:bg-[#121222]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-fg">Notifications</span>
                {unread > 0 && (
                  <span className="brand-gradient rounded-full px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await api('/notifications/read', { method: 'POST' }).catch(() => undefined);
                    invalidate('notifications');
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-line/40 bg-white dark:bg-[#0e0e1a]">
              {!data?.items.length ? (
                <p className="px-4 py-8 text-center text-sm text-muted">You’re all caught up ✨</p>
              ) : (
                data.items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (n.link) {
                        startNavigation();
                        router.push(n.link);
                      }
                    }}
                    className={cn(
                      'flex w-full gap-3 px-4 py-3 text-left transition-colors',
                      !n.readAt
                        ? 'bg-fuchsia-500/10 dark:bg-fuchsia-500/15 hover:bg-fuchsia-500/20'
                        : 'bg-white dark:bg-[#0e0e1a] hover:bg-line/40',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        n.readAt ? 'bg-muted/40' : 'brand-gradient shadow-xs',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg leading-snug">{n.title}</span>
                      {n.body && (
                        <span className="line-clamp-2 block text-xs text-muted mt-0.5">{n.body}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted font-medium">{timeAgo(n.createdAt)}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-line bg-white dark:bg-[#121222] p-2">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-primary hover:bg-line transition"
              >
                <span>See all notifications</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Title + one-line purpose per page, shown in the header so users always know where they are. */
const PAGE_INFO: { prefix: string; title: string; hint: string; back?: { href: string; label: string } }[] = [
  { prefix: '/posts/', title: 'Post details', hint: 'Video, channels and comments', back: { href: '/dashboard', label: 'Home' } },
  { prefix: '/channels/select', title: 'Choose accounts', hint: 'Pick which pages or accounts to connect', back: { href: '/channels', label: 'Channels' } },
  { prefix: '/channels/', title: 'Channel', hint: 'Videos, stats and comments', back: { href: '/channels', label: 'Channels' } },
  { prefix: '/schedules', title: 'My Schedules', hint: 'Everything queued to go out' },
  { prefix: '/calendar', title: 'Calendar', hint: 'Plan your month at a glance' },
  { prefix: '/comments', title: 'Comments', hint: 'Replies from every channel in one inbox' },
  { prefix: '/users', title: 'Customers', hint: 'Contacts, groups and WhatsApp sharing' },
  { prefix: '/automation', title: 'Automation', hint: 'Schedulers and order leads' },
  { prefix: '/channels', title: 'Channels', hint: 'Connect and manage your social accounts' },
  { prefix: '/media', title: 'Media', hint: 'Your photos and videos' },
  { prefix: '/analytics', title: 'Analytics', hint: 'Reach, engagement and growth' },
  { prefix: '/notifications', title: 'Notifications', hint: 'Alerts and activity' },
  { prefix: '/settings', title: 'Settings', hint: 'Account, WhatsApp, AI and billing' },
];

function Topbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const page = PAGE_INFO.find((p) => pathname.startsWith(p.prefix));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex min-w-0 items-center gap-2">
        {page?.back ? (
          <Link
            href={page.back.href}
            aria-label={`Back to ${page.back.label}`}
            className="glass flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:text-fg"
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <div className="md:hidden">
            <Logo href="/dashboard" />
          </div>
        )}
        {page ? (
          <div className={cn('min-w-0', !page.back && 'hidden md:block')}>
            <p className="truncate text-lg font-bold leading-tight tracking-tight md:text-xl">{page.title}</p>
            <p className="hidden truncate text-xs text-muted sm:block">{page.hint}</p>
          </div>
        ) : (
          <div className="hidden md:block">
            <p className="text-sm text-muted" suppressHydrationWarning>
              {greeting},
            </p>
            <p className="text-xl font-bold tracking-tight" suppressHydrationWarning>
              {user?.name.split(' ')[0] ?? 'there'} 👋
            </p>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationsBell />
        <ThemeToggle />
        <div className="md:hidden">
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}

interface MoreNavMenuItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  badge?: string;
}

const MORE_NAV_ITEMS: MoreNavMenuItem[] = [
  {
    href: '/channels',
    label: 'Channels',
    description: 'Social accounts & WhatsApp',
    icon: Plug,
    color: 'text-violet-500 dark:text-violet-400',
    bg: 'bg-violet-500/15 border-violet-500/25',
  },
  {
    href: '/comments',
    label: 'Comments',
    description: 'Viewer replies, sentiment & AI ideas',
    icon: MessageSquare,
    color: 'text-sky-500 dark:text-sky-400',
    bg: 'bg-sky-500/15 border-sky-500/25',
  },
  {
    href: '/automation',
    label: 'Automation',
    description: 'Custom schedulers & order leads',
    icon: Bot,
    color: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/25',
  },
  {
    href: '/media',
    label: 'Media Library',
    description: 'Photos, videos & asset files',
    icon: Images,
    color: 'text-fuchsia-500 dark:text-fuchsia-400',
    bg: 'bg-fuchsia-500/15 border-fuchsia-500/25',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    description: 'Reach, impressions & growth metrics',
    icon: ChartNoAxesColumn,
    color: 'text-purple-500 dark:text-purple-400',
    bg: 'bg-purple-500/15 border-purple-500/25',
  },
  {
    href: '/users',
    label: 'Customers',
    description: 'Customers & contact groups',
    icon: Users,
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500/15 border-amber-500/25',
  },
  {
    href: '/notifications',
    label: 'Notifications',
    description: 'Post alerts & activity log',
    icon: Bell,
    color: 'text-rose-500 dark:text-rose-400',
    bg: 'bg-rose-500/15 border-rose-500/25',
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'AI model keys, WhatsApp & billing',
    icon: Settings,
    color: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/25',
  },
];

function MobileMoreDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const content = (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[9990] flex flex-col justify-end md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Bottom Sheet */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="More navigation and menu items"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="glass relative z-10 flex max-h-[88dvh] w-full flex-col rounded-t-[32px] border-t border-line bg-card-strong/95 p-5 pb-8 shadow-2xl backdrop-blur-2xl"
            >
              {/* Drag Handle */}
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line/80" />

              {/* Sheet Header */}
              <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="brand-gradient flex size-7 items-center justify-center rounded-lg text-white shadow-xs">
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-fg">All Menus & Features</h2>
                    <p className="text-[11px] text-muted">Full navigation for mobile</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-1.5 text-muted hover:bg-line hover:text-fg transition"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Scrollable Container */}
              <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto min-h-0 pr-0.5">
                {/* User Profile Mini Card */}
                {user && (
                  <div className="rounded-2xl border border-line bg-card/60 p-3 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-fg">{user.name}</p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                        Active
                      </span>
                    </div>

                    {/* Profile Quick Action Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-line/60">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          setProfileOpen(true);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-line bg-elevated/70 px-2 py-1 text-xs font-semibold text-fg hover:bg-line transition"
                      >
                        <User className="size-3.5 text-fuchsia-500" />
                        <span>Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          setSecurityOpen(true);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-line bg-elevated/70 px-2 py-1 text-xs font-semibold text-fg hover:bg-line transition"
                      >
                        <KeyRound className="size-3.5 text-primary" />
                        <span>Security</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          setPrivacyOpen(true);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-line bg-elevated/70 px-2 py-1 text-xs font-semibold text-fg hover:bg-line transition"
                      >
                        <ShieldCheck className="size-3.5 text-emerald-500" />
                        <span>Privacy</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          onClose();
                          await logout();
                          toast('See you soon 👋');
                          router.replace('/login');
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition ml-auto"
                      >
                        <LogOut className="size-3.5" />
                        <span>Log out</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Remaining Navigation Items */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">
                      Apps & Tools
                    </p>
                    <span className="text-[11px] text-muted">Tap to open</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {MORE_NAV_ITEMS.map((item) => {
                      const active =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => {
                            onClose();
                            if (!isActive(pathname, item.href)) startNavigation();
                            router.push(item.href);
                          }}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition',
                            active
                              ? 'border-fuchsia-500/60 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30'
                              : 'border-line bg-card/60 hover:border-line/80 hover:bg-card',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                              item.bg,
                            )}
                          >
                            <item.icon className={cn('size-4', item.color)} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-fg">{item.label}</span>
                              {active && (
                                <span className="size-1.5 rounded-full bg-fuchsia-500 animate-pulse" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                          <ChevronRight className="size-3.5 text-muted/60 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Quick Access Section */}
                <div className="space-y-1.5 pt-1 border-t border-line/60">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted px-1">
                    Quick Access
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (!isActive(pathname, '/dashboard')) startNavigation();
                        router.push('/dashboard');
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition',
                        pathname === '/dashboard'
                          ? 'border-fuchsia-500/60 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30'
                          : 'border-line bg-card/40 hover:bg-card',
                      )}
                    >
                      <House className="size-4 text-fuchsia-500" />
                      <span className="text-xs font-semibold text-fg">Home</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (!isActive(pathname, '/schedules')) startNavigation();
                        router.push('/schedules');
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition',
                        pathname.startsWith('/schedules')
                          ? 'border-fuchsia-500/60 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30'
                          : 'border-line bg-card/40 hover:bg-card',
                      )}
                    >
                      <CalendarClock className="size-4 text-sky-500" />
                      <span className="text-xs font-semibold text-fg">Schedules</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (!isActive(pathname, '/calendar')) startNavigation();
                        router.push('/calendar');
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition',
                        pathname.startsWith('/calendar')
                          ? 'border-fuchsia-500/60 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30'
                          : 'border-line bg-card/40 hover:bg-card',
                      )}
                    >
                      <CalendarDays className="size-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-fg">Calendar</span>
                    </button>
                  </div>
                </div>

                {/* System & Brand Footer */}
                <div className="flex items-center justify-between rounded-2xl border border-line bg-card/40 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-fg">Appearance</span>
                    <ThemeToggle />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="opacity-70">Powered by</span>
                    <Wordmark height={14} />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SecurityModal open={securityOpen} onClose={() => setSecurityOpen(false)} />
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  );

  return createPortal(content, document.body);
}

const MOBILE_TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/schedules', label: 'Schedules', icon: CalendarClock },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
];

function TabButton({
  active,
  label,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
          active && 'bg-fuchsia-500/15',
        )}
      >
        <Icon
          className={cn('size-5', active ? 'text-fuchsia-500 dark:text-fuchsia-400' : 'text-muted')}
        />
      </span>
      <span
        className={cn(
          'text-[10px] font-semibold leading-none',
          active ? 'text-fg' : 'text-muted',
        )}
      >
        {label}
      </span>
    </span>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive =
    moreOpen || MORE_NAV_ITEMS.some((item) => isActive(pathname, item.href));

  const handleCreateClick = (e: React.MouseEvent) => {
    if (pathname === '/dashboard') {
      e.preventDefault();
      const el = document.getElementById('compose');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector('textarea')?.focus();
    }
  };

  const tab = (t: (typeof MOBILE_TABS)[number]) => (
    <Link
      key={t.href}
      href={t.href}
      aria-current={isActive(pathname, t.href) ? 'page' : undefined}
      className="flex flex-1 justify-center py-1"
    >
      <TabButton active={isActive(pathname, t.href)} label={t.label} icon={t.icon} />
    </Link>
  );

  return (
    <>
      <nav
        className="glass fixed inset-x-3 bottom-3 z-40 flex items-center rounded-3xl bg-card-strong px-1 py-1.5 shadow-2xl md:hidden"
        aria-label="Mobile navigation"
      >
        {tab(MOBILE_TABS[0])}
        {tab(MOBILE_TABS[1])}
        <Link
          href="/dashboard#compose"
          onClick={handleCreateClick}
          aria-label="Create post"
          className="flex flex-1 justify-center"
        >
          <span className="brand-gradient flex size-12 items-center justify-center rounded-full text-white shadow-lg shadow-fuchsia-500/40 transition active:scale-90">
            <SquarePen className="size-5" />
          </span>
        </Link>
        {tab(MOBILE_TABS[2])}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-label="More menus"
          aria-expanded={moreOpen}
          className="flex flex-1 justify-center py-1"
        >
          <TabButton active={isMoreActive} label="More" icon={MoreHorizontal} />
        </button>
      </nav>

      <MobileMoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  useLiveEvents(Boolean(user));
  return (
    <div className="relative flex min-h-dvh">
      <NavigationProgress />
      <GradientBlobs animated={false} />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col md:border-l md:border-line">
        <Topbar />
        <main className="flex-1 px-4 pb-28 md:px-8 md:pb-10">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
