'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, CircleCheck, Plug, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_RULES, PLATFORMS, type ChannelDto, type Platform } from '@mehwar/shared';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { Button, Card, Modal, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { invalidate, useApi } from '@/lib/hooks';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

const NOTES: Partial<Record<Platform, string>> = {
  instagram: 'Needs a Business or Creator account linked to a Facebook Page.',
  facebook: 'Choose which Pages to publish to after signing in.',
  tiktok: 'Unaudited apps can only post privately (“Only me”).',
  youtube: 'Uploads stay private until Google verifies the app.',
  snapchat: 'Publishing requires Snap partner access.',
};

async function connect(platform: Platform) {
  try {
    const { url } = await api<{ url: string }>(`/channels/connect/${platform}`, { method: 'POST' });
    window.location.href = url;
  } catch (err) {
    const e = err as ApiError;
    toast.error(
      e.body?.code === 'PLAN_LIMIT'
        ? 'Channel limit reached'
        : `Could not connect ${PLATFORM_RULES[platform].label}`,
      {
        description: e.message,
      },
    );
  }
}

function ChannelsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const channels = useApi<ChannelDto[]>('/channels', ['channels']);
  const available = useApi<{ platform: Platform; configured: boolean }[]>('/channels/available');
  const [removing, setRemoving] = useState<ChannelDto | null>(null);
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  // Feedback after returning from the OAuth redirect, or a deep link from the home row.
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const connected = params.get('connected') as Platform | null;
    const error = params.get('error');
    const toConnect = params.get('connect') as Platform | null;
    if (connected) toast.success(`${PLATFORM_RULES[connected]?.label ?? 'Channel'} connected 🎉`);
    if (error) toast.error('Connection failed', { description: error });
    if (connected || error) router.replace('/channels');
    if (toConnect && PLATFORMS.includes(toConnect)) {
      router.replace('/channels');
      document
        .getElementById(`platform-${toConnect}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [params, router]);

  async function disconnect() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/channels/${removing.id}`, { method: 'DELETE' });
      toast.success(`${removing.displayName} disconnected`);
      invalidate('channels', 'posts');
      setRemoving(null);
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const configured = new Map((available.data ?? []).map((a) => [a.platform, a.configured]));

  return (
    <div className="mx-auto max-w-4xl space-y-8 pt-2">
      <FadeIn>
        <h1 className="text-3xl font-black tracking-tight">Channels</h1>
        <p className="mt-1 text-sm text-muted">
          Connect your accounts once. Your login tokens are encrypted and never leave our servers.
        </p>
      </FadeIn>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Connected</h2>
        {channels.data === undefined ? (
          <Skeleton className="h-20 w-full rounded-3xl" />
        ) : channels.data.length === 0 ? (
          <Card className="text-sm text-muted">
            No channels yet. Pick a network below to connect your first account.
          </Card>
        ) : (
          <Stagger className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence>
              {channels.data.map((c) => {
                const ok = c.status === 'ACTIVE';
                return (
                  <StaggerItem key={c.id}>
                    <Card className="flex items-center gap-3 p-4">
                      <span
                        className="relative size-12 shrink-0 rounded-full p-[2px]"
                        style={{ background: PLATFORM_BRAND[c.platform].gradient }}
                      >
                        <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-elevated">
                          {c.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.avatarUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <PlatformIcon platform={c.platform} className="size-5" />
                          )}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.displayName}</p>
                        <p
                          className={`flex items-center gap-1 text-xs ${ok ? 'text-emerald-500' : 'text-amber-500'}`}
                        >
                          {ok ? (
                            <CircleCheck className="size-3.5" />
                          ) : (
                            <CircleAlert className="size-3.5" />
                          )}
                          {ok
                            ? `${PLATFORM_RULES[c.platform].label}${c.username ? ` · @${c.username}` : ''}`
                            : 'Needs reconnecting'}
                        </p>
                      </div>
                      {!ok && (
                        <Button size="sm" variant="secondary" onClick={() => connect(c.platform)}>
                          <RefreshCw className="size-3.5" /> Reconnect
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRemoving(c)}
                        className="rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-500"
                        aria-label={`Disconnect ${c.displayName}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </Card>
                  </StaggerItem>
                );
              })}
            </AnimatePresence>
          </Stagger>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Add a network</h2>
        <Stagger className="grid gap-3 sm:grid-cols-2">
          {PLATFORMS.map((p) => {
            const isConfigured = configured.get(p) ?? false;
            return (
              <StaggerItem key={p}>
                <motion.div whileHover={isConfigured ? { y: -4 } : undefined} id={`platform-${p}`}>
                  <Card className="flex items-center gap-4 p-4">
                    <span
                      className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
                      style={{ background: PLATFORM_BRAND[p].gradient }}
                    >
                      <PlatformIcon platform={p} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{PLATFORM_RULES[p].label}</p>
                      <p className="text-xs text-muted">
                        {isConfigured
                          ? (NOTES[p] ?? 'Sign in to connect.')
                          : 'Not set up on this server yet (see docs/PLATFORM_SETUP.md).'}
                      </p>
                    </div>
                    <Button size="sm" disabled={!isConfigured} onClick={() => connect(p)}>
                      <Plug className="size-3.5" /> Connect
                    </Button>
                  </Card>
                </motion.div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <Modal open={removing !== null} onClose={() => setRemoving(null)} title="Disconnect channel?">
        <p className="text-sm text-muted">
          <b className="text-fg">{removing?.displayName}</b> will be disconnected and its scheduled
          posts canceled. Published posts stay on{' '}
          {removing ? PLATFORM_RULES[removing.platform].label : ''}.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={disconnect} loading={busy}>
            Disconnect
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function ChannelsPage() {
  return (
    <Suspense>
      <ChannelsInner />
    </Suspense>
  );
}
