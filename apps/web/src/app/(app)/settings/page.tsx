'use client';

import { motion } from 'motion/react';
import {
  CreditCard,
  Download,
  KeyRound,
  Lock,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { UserDto } from '@mehwar/shared';
import { FadeIn } from '@/components/motion';
import { Avatar, Button, Card, Input, Modal, Switch } from '@/components/ui';
import { api, ApiError, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';
import { formatBytes } from '@/lib/media';
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
  const [brandVoice, setBrandVoice] = useState(user.brandVoice ?? '');
  const [saving, setSaving] = useState(false);
  const dirty =
    name !== user.name ||
    timezone !== user.timezone ||
    xPremium !== user.xPremium ||
    brandVoice !== (user.brandVoice ?? '');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api<UserDto>('/me', {
        method: 'PATCH',
        json: { name, timezone, xPremium, brandVoice: brandVoice.trim() || null },
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
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-muted">Brand voice (for the AI assistant)</span>
          <textarea
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="e.g. Warm and witty, speaks to busy parents, never uses slang, signs off with 💛"
            className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]"
          />
        </label>
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

interface BillingOverview {
  billingEnabled: boolean;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  limits: {
    label: string;
    channels: number;
    scheduledPosts: number;
    storageBytes: number;
    aiCreditsPerMonth: number;
  };
  usage: {
    channels: number;
    scheduledPosts: number;
    storageBytes: number;
    aiCreditsPerMonth: number;
  };
  plans: {
    id: 'pro' | 'business';
    label: string;
    priceUsd: number;
    channels: number;
    scheduledPosts: number;
    aiCreditsPerMonth: number;
  }[];
}

function UsageBar({
  label,
  used,
  limit,
  format = (n: number) => n.toLocaleString(),
}: {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
}) {
  const unlimited = limit >= Number.MAX_SAFE_INTEGER / 2;
  const ratio = unlimited ? 0 : Math.min(1, used / Math.max(limit, 1));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          {format(used)} {unlimited ? '' : `/ ${format(limit)}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-line">
        <motion.div
          className={cn('h-full rounded-full', ratio > 0.9 ? 'bg-red-500' : 'brand-gradient')}
          initial={{ width: 0 }}
          animate={{ width: unlimited ? '4%' : `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function BillingSection() {
  const { data } = useApi<BillingOverview>('/billing', ['billing', 'channels', 'posts', 'media']);
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (path: string, json?: object) => {
    setBusy(path);
    try {
      const { url } = await api<{ url: string }>(path, { method: 'POST', json });
      window.location.href = url;
    } catch (err) {
      toast.error((err as ApiError).message);
      setBusy(null);
    }
  };
  const gb = (n: number) => formatBytes(n);
  if (!data) return null;
  return (
    <Card className="space-y-4 bg-card-strong p-6" id="billing">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400">
            <CreditCard className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Plan & usage</h2>
            <p className="text-xs text-muted">
              {data.limits.label}
              {data.currentPeriodEnd
                ? ` · renews ${new Date(data.currentPeriodEnd).toLocaleDateString()}`
                : ''}
              {data.status !== 'active' ? ` · ${data.status}` : ''}
            </p>
          </div>
        </div>
        {data.billingEnabled && data.plan !== 'free' && (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === '/billing/portal'}
            onClick={() => go('/billing/portal')}
          >
            Manage billing
          </Button>
        )}
      </div>
      <div className="space-y-3">
        <UsageBar label="Channels" used={data.usage.channels} limit={data.limits.channels} />
        <UsageBar
          label="Scheduled posts"
          used={data.usage.scheduledPosts}
          limit={data.limits.scheduledPosts}
        />
        <UsageBar
          label="Media storage"
          used={data.usage.storageBytes}
          limit={data.limits.storageBytes}
          format={gb}
        />
        <UsageBar
          label="AI credits this month"
          used={data.usage.aiCreditsPerMonth}
          limit={data.limits.aiCreditsPerMonth}
        />
      </div>
      {data.billingEnabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.plans.map((p) => (
            <motion.div
              key={p.id}
              whileHover={{ y: -3 }}
              className={cn(
                'rounded-2xl border p-4',
                data.plan === p.id ? 'border-fuchsia-500' : 'border-line',
              )}
            >
              <p className="font-bold">{p.label}</p>
              <p className="text-2xl font-black">
                ${p.priceUsd}
                <span className="text-sm font-medium text-muted">/mo</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {p.channels} channels · {p.scheduledPosts.toLocaleString()} scheduled posts ·{' '}
                {p.aiCreditsPerMonth.toLocaleString()} AI credits
              </p>
              <Button
                size="sm"
                className="mt-3 w-full"
                disabled={data.plan === p.id}
                loading={busy === `/billing/checkout:${p.id}`}
                onClick={() => {
                  setBusy(`/billing/checkout:${p.id}`);
                  void go('/billing/checkout', { plan: p.id });
                }}
              >
                {data.plan === p.id ? 'Current plan' : `Upgrade to ${p.label}`}
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PrivacySection() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await api('/me', { method: 'DELETE', json: { password } });
      toast('Your account was deleted. Goodbye 👋');
      await logout();
    } catch (err) {
      toast.error((err as ApiError).message);
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-4 bg-card-strong p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">Your data</h2>
          <p className="text-xs text-muted">
            Download everything we store about you, or delete your account.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            downloadFile('/me/export', 'mehwar-export.json').catch(() =>
              toast.error('Export failed'),
            )
          }
        >
          <Download className="size-4" /> Export my data
        </Button>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" /> Delete account
        </Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            This disconnects every channel, cancels scheduled posts and permanently deletes your
            posts, media and settings. Posts already published stay on the networks.
          </p>
          <Input
            label="Confirm with your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="size-4" />}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={busy} disabled={!password}>
              Delete forever
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  useEffect(() => {
    if (params?.get('checkout') === 'success') {
      toast.success('Thanks for upgrading! 🎉', { description: 'Your new plan is active.' });
      invalidate('billing');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
      <FadeIn delay={0.24}>
        <BillingSection />
      </FadeIn>
      <FadeIn delay={0.32}>
        <PrivacySection />
      </FadeIn>
    </div>
  );
}
