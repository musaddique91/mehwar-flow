'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  CalendarDays,
  ChartNoAxesColumn,
  House,
  LogOut,
  Settings,
  SquarePen,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { GradientBlobs } from '@/components/motion';
import { Avatar, Badge } from '@/components/ui';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, soon: true },
  { href: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn, soon: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function comingSoon(label: string) {
  toast(`${label} is on its way`, { description: 'We’re building it right now. Stay tuned! 🚀' });
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
          const active = pathname === item.href;
          const content = (
            <>
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
              {item.soon && <Badge className="relative">Soon</Badge>}
            </>
          );
          const cls = cn(
            'relative flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-colors',
            active ? 'text-fg' : 'text-muted hover:text-fg',
          );
          return item.soon ? (
            <button key={item.href} onClick={() => comingSoon(item.label)} className={cls}>
              {content}
            </button>
          ) : (
            <Link key={item.href} href={item.href} className={cls}>
              {content}
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
      <div className="mt-auto">
        <UserMenu />
      </div>
    </aside>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;
  return (
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
              'glass absolute z-50 w-56 rounded-2xl bg-card-strong p-1.5 shadow-2xl',
              compact ? 'right-0 top-12' : 'bottom-16 left-0',
            )}
          >
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-line"
            >
              <Settings className="size-4" /> Settings
            </Link>
            <button
              onClick={async () => {
                await logout();
                toast('See you soon 👋');
                router.replace('/login');
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
            >
              <LogOut className="size-4" /> Log out
            </button>
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
        <p className="text-sm text-muted">{greeting},</p>
        <p className="text-xl font-bold tracking-tight">{user?.name.split(' ')[0] ?? 'there'} 👋</p>
      </div>
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => toast('You’re all caught up ✨')}
          className="glass relative flex size-10 items-center justify-center rounded-full"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-fuchsia-500 ring-2 ring-[var(--bg)]" />
        </motion.button>
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
  const items = [
    NAV[0]!,
    NAV[1]!,
    { href: '/dashboard#compose', label: 'Create', icon: SquarePen },
    NAV[2]!,
    NAV[3]!,
  ];
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full bg-card-strong px-2 py-2 shadow-2xl md:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        const isCreate = item.label === 'Create';
        const inner = isCreate ? (
          <span className="brand-gradient flex size-12 items-center justify-center rounded-full text-white shadow-lg shadow-fuchsia-500/40">
            <item.icon className="size-5" />
          </span>
        ) : (
          <span className="relative flex size-11 items-center justify-center">
            {active && (
              <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-line" />
            )}
            <item.icon
              className={cn(
                'relative size-5',
                active ? 'text-fuchsia-500 dark:text-fuchsia-400' : 'text-muted',
              )}
            />
          </span>
        );
        return 'soon' in item && item.soon ? (
          <button key={item.href} onClick={() => comingSoon(item.label)} aria-label={item.label}>
            {inner}
          </button>
        ) : (
          <Link key={item.href} href={item.href} aria-label={item.label}>
            <motion.span whileTap={{ scale: 0.85 }} className="block">
              {inner}
            </motion.span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
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
