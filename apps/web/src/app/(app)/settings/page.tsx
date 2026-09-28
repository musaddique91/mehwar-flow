'use client';

import { motion } from 'motion/react';
import { KeyRound, Lock, Search, Settings, User } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { UserDto } from '@mehwar/shared';
import { FadeIn } from '@/components/motion';
import { Avatar, Button, Card, Input, Switch } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { PlatformIcon } from '@/lib/platforms';

const TIME_ZONES: string[] =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];

function TimeZonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    // The selected zone always comes first so it's visible without scrolling.
    const all = [value, ...TIME_ZONES.filter((tz) => tz !== value)];
    const q = query.trim().toLowerCase().replace(/\s+/g, '_');
    return (q ? all.filter((tz) => tz.toLowerCase().includes(q)) : all).slice(0, 60);
  }, [query, value]);

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted">Time zone</span>
      <div className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-elevated/60 px-3 focus-within:ring-4 focus-within:ring-[var(--ring)]">
        <Search className="size-4 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search… (current: ${value})`}
          className="w-full bg-transparent text-sm outline-none"
          aria-label="Search time zones"
        />
      </div>
      <div className="no-scrollbar max-h-52 space-y-0.5 overflow-y-auto rounded-2xl border border-line p-1.5">
        {options.map((tz) => (
          <button
            key={tz}
            type="button"
            onClick={() => onChange(tz)}
            className={cn(
              'relative flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm',
              tz === value ? 'font-semibold text-fg' : 'text-muted hover:bg-line hover:text-fg',
            )}
          >
            {tz === value && (
              <motion.span layoutId="tz-active" className="absolute inset-0 rounded-xl bg-line" />
            )}
            <span className="relative">{tz.replace(/_/g, ' ')}</span>
          </button>
        ))}
        {options.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-muted">No match</p>
        )}
      </div>
    </div>
  );
}

function ProfileSection({ user }: { user: UserDto }) {
  const { setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [xPremium, setXPremium] = useState(user.xPremium);
  const [saving, setSaving] = useState(false);
  const dirty = name !== user.name || timezone !== user.timezone || xPremium !== user.xPremium;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api<UserDto>('/me', {
        method: 'PATCH',
        json: { name, timezone, xPremium },
      });
      setUser(updated);
      toast.success('Profile saved');
    } catch (err) {
      toast.error('Could not save', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-card-strong p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={name || user.name} size={64} />
          <div>
            <h2 className="text-lg font-bold">Profile</h2>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <Input
          label="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={<User className="size-4" />}
        />
        <TimeZonePicker value={timezone} onChange={setTimezone} />
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-fg text-[var(--bg)]">
              <PlatformIcon platform="x" className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">X Premium</p>
              <p className="text-xs text-muted">Allow posts up to 25,000 characters on X</p>
            </div>
          </div>
          <Switch checked={xPremium} onChange={setXPremium} label="X Premium" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { logout } = useAuth();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api('/me/password', {
        method: 'POST',
        json: { currentPassword: current, newPassword: next },
      });
      toast.success('Password changed', {
        description: 'Please log in again with your new password.',
      });
      await logout();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401)
        setErrors({ current: 'Current password is incorrect' });
      else if (err instanceof ApiError && err.errors) {
        setErrors({
          next: err.errors.find((x) => x.path === 'newPassword')?.message ?? err.message,
        });
      } else toast.error('Could not change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="bg-card-strong p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Password</h2>
            <p className="text-xs text-muted">Changing it signs you out everywhere.</p>
          </div>
        </div>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          icon={<Lock className="size-4" />}
          error={errors.current}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          icon={<Lock className="size-4" />}
          error={errors.next}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            loading={busy}
            disabled={!current || next.length < 10}
          >
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-2">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight">
          <Settings className="size-7 text-fuchsia-500 dark:text-fuchsia-400" /> Settings
        </h1>
      </FadeIn>
      <FadeIn delay={0.08}>
        <ProfileSection user={user} />
      </FadeIn>
      <FadeIn delay={0.16}>
        <PasswordSection />
      </FadeIn>
    </div>
  );
}
