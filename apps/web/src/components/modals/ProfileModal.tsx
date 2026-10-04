'use client';

import { motion } from 'motion/react';
import { Search, User } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { UserDto } from '@mehwar/shared';
import { Avatar, Button, Input, Modal, Switch } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { PlatformIcon } from '@/lib/platforms';

const TIME_ZONES: string[] =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];

function TimeZonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const all = [value, ...TIME_ZONES.filter((tz) => tz !== value)];
    const q = query.trim().toLowerCase().replace(/\s+/g, '_');
    return (q ? all.filter((tz) => tz.toLowerCase().includes(q)) : all).slice(0, 60);
  }, [query, value]);

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Time zone</span>
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
      <div className="no-scrollbar max-h-44 space-y-0.5 overflow-y-auto rounded-2xl border border-line p-1.5">
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
              <motion.span layoutId="tz-active-modal" className="absolute inset-0 rounded-xl bg-line" />
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

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, setUser } = useAuth();
  if (!user) return null;

  return <ProfileModalInner user={user} open={open} onClose={onClose} setUser={setUser} />;
}

function ProfileModalInner({
  user,
  open,
  onClose,
  setUser,
}: {
  user: UserDto;
  open: boolean;
  onClose: () => void;
  setUser: (u: UserDto) => void;
}) {
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
        json: { name: name.trim(), timezone, xPremium, brandVoice: brandVoice.trim() || null },
      });
      setUser(updated);
      toast.success('Profile saved successfully');
      onClose();
    } catch (err) {
      toast.error('Could not save profile', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Profile Settings" maxWidth="max-w-lg">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl bg-line/30 p-3">
          <Avatar name={name || user.name} size={56} />
          <div className="min-w-0">
            <h3 className="font-bold text-base text-fg truncate">{name || user.name}</h3>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
        </div>

        <Input
          label="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={<User className="size-4" />}
          placeholder="Your full name"
          required
        />

        <TimeZonePicker value={timezone} onChange={setTimezone} />

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line p-3.5 bg-card/40">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-fg text-[var(--bg)] shadow-sm">
              <PlatformIcon platform="x" className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-fg">X Premium</p>
              <p className="text-[11px] text-muted">Allow posts up to 25,000 characters on X</p>
            </div>
          </div>
          <Switch checked={xPremium} onChange={setXPremium} label="X Premium" />
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Brand voice (for AI assistant)
          </span>
          <textarea
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="e.g. Warm and witty, speaks to busy parents, never uses slang..."
            className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-3 text-sm text-fg outline-none focus:border-fuchsia-400/60 focus:ring-4 focus:ring-fuchsia-500/15 transition resize-none"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-line/60">
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!dirty || !name.trim()}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
