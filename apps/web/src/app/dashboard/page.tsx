'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { PLATFORM_RULES, PLATFORMS, type Platform, type UserDto } from '@mehwar/shared';
import { Alert, Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface ChannelDto {
  id: string;
  platform: Platform;
  displayName: string;
  username: string | null;
  status: 'ACTIVE' | 'NEEDS_RECONNECT' | 'DISCONNECTED';
}

const TIME_ZONES: string[] =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelDto[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user)
      api<ChannelDto[]>('/channels')
        .then(setChannels)
        .catch(() => setChannels([]));
  }, [user]);

  if (loading || !user) return <p className="p-8 text-slate-500">Loading…</p>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold">Mehwar Flow</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">{user.email}</span>
            <button
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <Card>
            <h2 className="mb-1 text-lg font-semibold">Channels</h2>
            <p className="mb-4 text-sm text-slate-500">
              Connect the accounts you want to publish to.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {PLATFORMS.map((platform) => {
                const connected = channels.filter((c) => c.platform === platform);
                return (
                  <li
                    key={platform}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div>
                      <p className="font-medium">{PLATFORM_RULES[platform].label}</p>
                      <p className="text-xs text-slate-500">
                        {connected.length
                          ? connected.map((c) => c.displayName).join(', ')
                          : 'Not connected'}
                      </p>
                    </div>
                    <Button disabled title="OAuth connections arrive in the next phase">
                      Connect
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
        <aside>
          <ProfileCard user={user} />
        </aside>
      </main>
    </div>
  );
}

function ProfileCard({ user }: { user: UserDto }) {
  const { setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<UserDto>('/me', {
        method: 'PATCH',
        json: {
          name: String(form.get('name')),
          timezone: String(form.get('timezone')),
          xPremium: form.get('xPremium') === 'on',
        },
      });
      setUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Profile</h2>
      <form onSubmit={onSubmit} className="space-y-4 text-sm">
        <label className="block space-y-1">
          <span className="font-medium">Name</span>
          <input
            name="name"
            defaultValue={user.name}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block space-y-1">
          <span className="font-medium">Time zone</span>
          <select
            name="timezone"
            defaultValue={user.timezone}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            {(TIME_ZONES.includes(user.timezone) ? TIME_ZONES : [user.timezone, ...TIME_ZONES]).map(
              (tz) => (
                <option key={tz}>{tz}</option>
              ),
            )}
          </select>
          <span className="text-xs text-slate-500">
            Scheduled times are shown and entered in this zone.
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="xPremium" defaultChecked={user.xPremium} />
          <span>I have X Premium (25,000 character posts)</span>
        </label>
        {error && <Alert>{error}</Alert>}
        <Button type="submit">Save</Button>
        {saved && <span className="ml-3 text-green-600">Saved</span>}
      </form>
    </Card>
  );
}
