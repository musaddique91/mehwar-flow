'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Eye,
  Film,
  Heart,
  Info,
  MessageSquare,
  Plug,
  Plus,
  QrCode,
  RefreshCw,
  Settings,
  ThumbsUp,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_RULES, PLATFORMS, type ChannelDto, type Platform } from '@mehwar/shared';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { WhatsAppModal } from '@/components/modals/WhatsAppModal';
import { Button, Card, Modal, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

const NOTES: Partial<Record<Platform, string>> = {
  instagram: 'Needs a Business or Creator account linked to a Facebook Page.',
  facebook: 'Choose which Pages to publish to after signing in.',
  tiktok: 'Unaudited apps can only post privately (“Only me”).',
  youtube: 'Uploads stay private until Google verifies the app.',
  snapchat: 'Publishing requires Snap partner access.',
  linkedin: 'Requires Share on LinkedIn & Sign In with LinkedIn products enabled.',
  whatsapp: 'Pair via QR code or configure in Settings to dispatch customer updates.',
};

interface YouTubeVideoItem {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  views: number;
  likes: number;
  comments: number;
  duration: string;
  isShort: boolean;
  url: string;
}

interface YouTubeChannelDetails {
  channelId: string;
  title: string;
  description: string;
  customUrl: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
  videos: YouTubeVideoItem[];
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function ChannelDetailsModal({
  channel,
  onClose,
}: {
  channel: ChannelDto;
  onClose: () => void;
}) {
  const details = useApi<YouTubeChannelDetails>(`/channels/${channel.id}/details`);
  const [filter, setFilter] = useState<'all' | 'shorts' | 'videos'>('all');

  const data = details.data;
  const filteredVideos = (data?.videos ?? []).filter((v) => {
    if (filter === 'shorts') return v.isShort;
    if (filter === 'videos') return !v.isShort;
    return true;
  });

  return (
    <Modal open onClose={onClose} title={channel.displayName} maxWidth="max-w-3xl">
      <div className="max-h-[80vh] overflow-y-auto space-y-6 pr-1">
        {details.loading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Channel Header Banner & Stats */}
            <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-5">
              {data.bannerUrl && (
                <div className="absolute inset-0 -z-10 opacity-30 blur-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.bannerUrl} alt="" className="size-full object-cover" />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <span
                  className="relative size-16 shrink-0 rounded-full p-[2px]"
                  style={{ background: PLATFORM_BRAND[channel.platform]?.gradient || PLATFORM_BRAND.youtube.gradient }}
                >
                  <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-elevated">
                    {data.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <PlatformIcon platform={channel.platform} className="size-7" />
                    )}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold truncate">{data.title}</h3>
                  <p className="text-xs text-muted">
                    {data.customUrl ? `@${data.customUrl}` : `${PLATFORM_RULES[channel.platform]?.label || 'Connected'} Channel`}
                  </p>
                  {data.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{data.description}</p>
                  )}
                </div>
              </div>

              {/* Stats KPI Tiles */}
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-elevated/70 p-3 border border-line">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted mb-1">
                    <Users className="size-3.5 text-red-500" />
                    <span>Subscribers</span>
                  </div>
                  <p className="text-lg font-black">{formatNumber(data.subscriberCount)}</p>
                </div>
                <div className="rounded-xl bg-elevated/70 p-3 border border-line">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted mb-1">
                    <Eye className="size-3.5 text-blue-500" />
                    <span>Total Views</span>
                  </div>
                  <p className="text-lg font-black">{formatNumber(data.viewCount)}</p>
                </div>
                <div className="rounded-xl bg-elevated/70 p-3 border border-line">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted mb-1">
                    <Video className="size-3.5 text-emerald-500" />
                    <span>Videos</span>
                  </div>
                  <p className="text-lg font-black">{formatNumber(data.videoCount)}</p>
                </div>
              </div>
            </div>

            {/* Videos & Shorts Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted">
                  Recent Content ({filteredVideos.length})
                </h4>
                <div className="flex gap-1 rounded-xl bg-elevated p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={`rounded-lg px-3 py-1.5 font-medium transition ${
                      filter === 'all' ? 'bg-primary text-primary-foreground shadow' : 'text-muted hover:text-fg'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('shorts')}
                    className={`rounded-lg px-3 py-1.5 font-medium transition ${
                      filter === 'shorts' ? 'bg-primary text-primary-foreground shadow' : 'text-muted hover:text-fg'
                    }`}
                  >
                    ⚡ Shorts
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('videos')}
                    className={`rounded-lg px-3 py-1.5 font-medium transition ${
                      filter === 'videos' ? 'bg-primary text-primary-foreground shadow' : 'text-muted hover:text-fg'
                    }`}
                  >
                    📹 Long Videos
                  </button>
                </div>
              </div>

              {filteredVideos.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">
                  No {filter !== 'all' ? filter : 'videos'} found for this channel.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredVideos.map((v) => (
                    <a
                      key={v.id}
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-card transition hover:border-red-500/50 hover:shadow-lg"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-muted">
                        {v.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.thumbnailUrl}
                            alt=""
                            className="size-full object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <Film className="size-8 text-muted" />
                          </div>
                        )}
                        {v.isShort && (
                          <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                            ⚡ SHORT
                          </span>
                        )}
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-white">
                          <ExternalLink className="inline size-3 mr-0.5" /> Watch
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-3">
                        <h5 className="line-clamp-2 text-xs font-semibold group-hover:text-red-500">
                          {v.title}
                        </h5>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted border-t border-line/50 pt-2">
                          <span className="flex items-center gap-1 font-medium text-fg">
                            <Eye className="size-3.5 text-blue-500" />
                            {formatNumber(v.views)} views
                          </span>
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="size-3 text-red-500" />
                            {formatNumber(v.likes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="size-3 text-emerald-500" />
                            {formatNumber(v.comments)}
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function cleanErrorMessage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function ChannelsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const channels = useApi<ChannelDto[]>('/channels', ['channels']);
  const initialPlatform = (params.get('platform') as Platform | null) || 'all';
  const initialChannelId = params.get('channel') || params.get('id');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>(initialPlatform);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(initialChannelId);
  const [oauthError, setOauthError] = useState<string | null>(cleanErrorMessage(params.get('error')));
  const [removing, setRemoving] = useState<ChannelDto | null>(null);
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTabsScroll = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkTabsScroll();
    const el = tabsScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkTabsScroll, { passive: true });
    window.addEventListener('resize', checkTabsScroll);
    const ro = new ResizeObserver(checkTabsScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkTabsScroll);
      window.removeEventListener('resize', checkTabsScroll);
      ro.disconnect();
    };
  }, [channels.data]);

  const scrollTabs = (dir: 'left' | 'right') => {
    tabsScrollRef.current?.scrollBy({
      left: dir === 'left' ? -220 : 220,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    const p = params.get('platform') as Platform | null;
    const c = params.get('channel') || params.get('id');
    const err = params.get('error');
    if (p) setPlatformFilter(p);
    if (err) setOauthError(cleanErrorMessage(err));
    if (c) {
      setSelectedChannelId(c);
      setTimeout(() => {
        const el = document.getElementById(`channel-${c}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [params]);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const connected = params.get('connected') as Platform | null;
    const error = params.get('error');
    if (connected) {
      toast.success(`${PLATFORM_RULES[connected]?.label ?? 'Channel'} connected 🎉`);
      router.replace('/channels');
    }
    if (error) {
      const decoded = cleanErrorMessage(error);
      setOauthError(decoded);
      toast.error('Connection failed', { description: decoded });
    }
  }, [params, router]);

  async function disconnect() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/channels/${removing.id}`, { method: 'DELETE' });
      toast.success(`${removing.displayName} deleted`);
      invalidate('channels', 'posts');
      setRemoving(null);
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: channels.data?.length ?? 0 };
    for (const p of PLATFORMS) {
      counts[p] = 0;
    }
    if (channels.data) {
      for (const c of channels.data) {
        counts[c.platform] = (counts[c.platform] || 0) + 1;
      }
    }
    return counts;
  }, [channels.data]);

  const filteredChannels = useMemo(() => {
    if (!channels.data) return [];
    if (platformFilter === 'all') return channels.data;
    return channels.data.filter((c) => c.platform === platformFilter);
  }, [channels.data, platformFilter]);

  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  return (
    <div className="w-full space-y-8 pt-2">
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Channels</h1>
            <p className="mt-1 text-sm text-muted">
              View and manage all connected channels or filter by social media platform.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWhatsappModalOpen(true)}
              className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <PlatformIcon platform="whatsapp" className="size-3.5" />
              <span>Connect WhatsApp</span>
            </Button>
            <Link href="/settings#networks">
              <Button size="sm">
                <Plus className="size-4" /> Add Network
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* OAuth Error Alert Banner */}
      {oauthError && (
        <FadeIn>
          <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CircleAlert className="size-4 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-fg">Channel Connection Issue</p>
                  <p className="text-red-300 leading-relaxed font-mono text-[11px] bg-red-950/40 px-2.5 py-1.5 rounded-lg border border-red-500/20">
                    {oauthError}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOauthError(null)}
                className="text-muted hover:text-fg font-bold p-1 rounded-lg hover:bg-red-500/10 transition"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>

            {(oauthError.toLowerCase().includes('openid') ||
              oauthError.toLowerCase().includes('linkedin')) && (
              <div className="mt-1 space-y-2 rounded-xl bg-red-950/30 border border-red-500/20 p-3.5 text-xs">
                <p className="font-semibold text-red-200">
                  How to fix this in the LinkedIn Developer Portal:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-[11px] leading-relaxed">
                  <li>
                    Go to the{' '}
                    <a
                      href="https://www.linkedin.com/developers/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-fuchsia-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      LinkedIn Developer Portal <ExternalLink className="size-3 inline ml-0.5" />
                    </a>{' '}
                    and select your app.
                  </li>
                  <li>
                    Click the <b>Products</b> tab.
                  </li>
                  <li>
                    Add / Request access to <b>"Sign In with LinkedIn using OpenID Connect"</b> and <b>"Share on LinkedIn"</b>.
                  </li>
                  <li>
                    Once requested, return to{' '}
                    <Link href="/settings#networks" className="font-semibold text-fuchsia-400 hover:underline">
                      Settings → Networks
                    </Link>{' '}
                    and try connecting LinkedIn again.
                  </li>
                </ol>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {/* Platform Filter Tabs */}
      <FadeIn delay={0.05}>
        <div className="relative group/tabs">
          {/* Left edge fade gradient */}
          <AnimatePresence>
            {canScrollLeft && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute left-0 top-0 bottom-1 z-[5] w-14 bg-gradient-to-r from-bg via-bg/80 to-transparent"
              />
            )}
          </AnimatePresence>

          {/* Right edge fade gradient */}
          <AnimatePresence>
            {canScrollRight && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute right-0 top-0 bottom-1 z-[5] w-14 bg-gradient-to-l from-bg via-bg/80 to-transparent"
              />
            )}
          </AnimatePresence>

          {/* Left scroll arrow */}
          <AnimatePresence>
            {canScrollLeft && (
              <motion.button
                key="tab-scroll-left"
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => scrollTabs('left')}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex size-8 items-center justify-center rounded-full glass border border-line shadow-lg text-fg hover:bg-card-strong hover:scale-105 active:scale-95 transition"
                aria-label="Scroll channels left"
              >
                <ChevronLeft className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Right scroll arrow */}
          <AnimatePresence>
            {canScrollRight && (
              <motion.button
                key="tab-scroll-right"
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => scrollTabs('right')}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex size-8 items-center justify-center rounded-full glass border border-line shadow-lg text-fg hover:bg-card-strong hover:scale-105 active:scale-95 transition"
                aria-label="Scroll channels right"
              >
                <ChevronRight className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>

          <div
            ref={tabsScrollRef}
            className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth"
          >
            <button
              type="button"
              onClick={() => setPlatformFilter('all')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                platformFilter === 'all'
                  ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fg shadow-sm'
                  : 'border-line bg-card/60 text-muted hover:border-line/80 hover:text-fg'
              }`}
            >
              <span>All Channels</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  platformFilter === 'all'
                    ? 'bg-fuchsia-500 text-white'
                    : 'bg-line text-muted-foreground'
                }`}
              >
                {channelCounts.all}
              </span>
            </button>

            {PLATFORMS.map((p) => {
              const count = channelCounts[p] || 0;
              const active = platformFilter === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatformFilter(p)}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold transition ${
                    active
                      ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fg shadow-sm'
                      : 'border-line bg-card/60 text-muted hover:border-line/80 hover:text-fg'
                  }`}
                >
                  <span
                    className="flex size-5 items-center justify-center rounded-full text-white"
                    style={{ background: PLATFORM_BRAND[p].gradient }}
                  >
                    <PlatformIcon platform={p} className="size-3" />
                  </span>
                  <span>{PLATFORM_RULES[p].label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-fuchsia-500 text-white' : 'bg-line text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* Connected Channels List */}
      <section className="space-y-3">
        {channels.error ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center bg-card-strong border-red-500/20">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-500 mb-3">
              <CircleAlert className="size-6" />
            </div>
            <h3 className="font-bold text-lg">Unable to load channels</h3>
            <p className="mt-1 text-sm text-muted max-w-sm">
              {channels.error.message || 'There was an error communicating with the server.'}
            </p>
            <Button variant="secondary" onClick={() => channels.refetch()} className="mt-4">
              <RefreshCw className="size-4 mr-2" /> Try Again
            </Button>
          </Card>
        ) : channels.data === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-3xl" />
            ))}
          </div>
        ) : channels.data.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center bg-card-strong">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400 mb-3">
              <Plug className="size-6" />
            </div>
            <h3 className="font-bold text-lg">No connected channels yet</h3>
            <p className="mt-1 text-sm text-muted max-w-sm">
              Connect your YouTube, X, Facebook, Instagram, or LinkedIn accounts in Settings to start publishing.
            </p>
            <Link href="/settings#networks" className="mt-5">
              <Button>
                <Plus className="size-4" /> Add a Network in Settings
              </Button>
            </Link>
          </Card>
        ) : filteredChannels.length === 0 ? (
          platformFilter === 'whatsapp' ? (
            <Card className="flex flex-col items-center justify-center p-8 text-center bg-card-strong border-emerald-500/20">
              <span
                className="flex size-14 items-center justify-center rounded-2xl text-white shadow-lg mb-3"
                style={{ background: PLATFORM_BRAND.whatsapp.gradient }}
              >
                <PlatformIcon platform="whatsapp" className="size-7" />
              </span>
              <h3 className="font-bold text-lg">No WhatsApp Channel Connected</h3>
              <p className="mt-1 text-sm text-muted max-w-sm">
                Pair your WhatsApp account via QR scan or configure your WhatsApp session in Settings to dispatch videos and posts directly to your customers.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                <Button
                  variant="primary"
                  onClick={() => setWhatsappModalOpen(true)}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <QrCode className="size-4" /> Scan QR to Connect
                </Button>
                <Link href="/settings?tab=whatsapp">
                  <Button variant="secondary" className="gap-1.5">
                    <Settings className="size-4" /> WhatsApp Settings
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center p-8 text-center bg-card-strong">
              {platformFilter !== 'all' && (
                <span
                  className="flex size-12 items-center justify-center rounded-2xl text-white shadow-md mb-3"
                  style={{ background: PLATFORM_BRAND[platformFilter].gradient }}
                >
                  <PlatformIcon platform={platformFilter} className="size-6" />
                </span>
              )}
              <h3 className="font-bold text-lg">
                No {platformFilter !== 'all' ? PLATFORM_RULES[platformFilter].label : ''} channels connected
              </h3>
              <p className="mt-1 text-sm text-muted max-w-sm">
                You haven't connected any {platformFilter !== 'all' ? PLATFORM_RULES[platformFilter].label : ''} accounts yet.
              </p>
              <Link href={platformFilter !== 'all' ? `/settings?connect=${platformFilter}` : '/settings#networks'} className="mt-5">
                <Button variant="secondary">
                  <Plug className="size-4" /> Connect {platformFilter !== 'all' ? PLATFORM_RULES[platformFilter].label : 'Network'} in Settings
                </Button>
              </Link>
            </Card>
          )
        ) : (
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {filteredChannels.map((c) => {
                const ok = c.status === 'ACTIVE';
                return (
                  <StaggerItem key={c.id}>
                    <Card
                      id={`channel-${c.id}`}
                      className={cn(
                        'flex flex-col justify-between p-5 bg-card-strong border rounded-3xl space-y-4 transition shadow-sm',
                        selectedChannelId === c.id
                          ? 'border-fuchsia-500 ring-2 ring-fuchsia-500 shadow-lg shadow-fuchsia-500/20'
                          : 'border-line hover:border-line/80',
                      )}
                    >
                      {/* Top Row: Avatar with Platform Badge + Name & Handle */}
                      <Link
                        href={`/channels/${c.id}`}
                        className="flex items-start gap-3.5 group/card cursor-pointer"
                        title={`View ${c.displayName} details`}
                      >
                        <div className="relative shrink-0">
                          <span
                            className="relative block size-14 rounded-full p-[2px] shadow-sm transition group-hover/card:scale-105"
                            style={{ background: PLATFORM_BRAND[c.platform].gradient }}
                          >
                            <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-elevated">
                              {c.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={c.avatarUrl} alt="" className="size-full object-cover" />
                              ) : (
                                <PlatformIcon platform={c.platform} className="size-6" />
                              )}
                            </span>
                          </span>
                          {/* Small Social Media Icon Badge */}
                          <span
                            className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg)] shadow-md"
                            style={{ background: PLATFORM_BRAND[c.platform].gradient }}
                            title={PLATFORM_RULES[c.platform].label}
                          >
                            <PlatformIcon platform={c.platform} className="size-3" />
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-bold text-base text-fg group-hover/card:text-primary transition" title={c.displayName}>
                            {c.displayName}
                          </h3>
                          <p className="text-xs text-muted truncate mt-0.5">
                            {c.username ? `@${c.username}` : PLATFORM_RULES[c.platform].label}
                          </p>

                          <div className="mt-2 flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                              }`}
                            >
                              {ok ? <CircleCheck className="size-3" /> : <CircleAlert className="size-3" />}
                              {ok ? 'Active' : 'Needs reconnecting'}
                            </span>
                            {selectedChannelId === c.id && (
                              <span className="inline-flex items-center rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold text-fuchsia-400">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Card Action Buttons Footer */}
                      <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-3 mt-auto">
                        {ok ? (
                          <Link href={`/channels/${c.id}`} className="flex-1">
                            <Button size="sm" variant="secondary" className="w-full justify-center">
                              <BarChart2 className="size-3.5 mr-1.5" /> Details
                            </Button>
                          </Link>
                        ) : c.platform === 'whatsapp' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 justify-center"
                            onClick={() => setWhatsappModalOpen(true)}
                          >
                            <QrCode className="size-3.5 mr-1.5" /> Reconnect
                          </Button>
                        ) : (
                          <Link href={`/settings?connect=${c.platform}`} className="flex-1">
                            <Button size="sm" variant="secondary" className="w-full justify-center">
                              <RefreshCw className="size-3.5 mr-1.5" /> Reconnect
                            </Button>
                          </Link>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRemoving(c)}
                          className="text-red-500 hover:bg-red-500/10 hover:text-red-600 px-3"
                          title={`Delete ${c.displayName}`}
                          aria-label={`Delete ${c.displayName}`}
                        >
                          <Trash2 className="size-3.5 mr-1 text-red-500" /> Delete
                        </Button>
                      </div>
                    </Card>
                  </StaggerItem>
                );
              })}
            </AnimatePresence>
          </Stagger>
        )}
      </section>

      <Modal open={removing !== null} onClose={() => !busy && setRemoving(null)} title="Delete channel?">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to delete and disconnect <b className="text-fg">{removing?.displayName}</b>?
          </p>
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-400">
            ⚠️ All scheduled posts for this channel will be canceled. Published posts will remain on{' '}
            {removing ? PLATFORM_RULES[removing.platform].label : 'the platform'}.
          </div>
          <div className="mt-5 flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={disconnect} loading={busy}>
              Delete channel
            </Button>
          </div>
        </div>
      </Modal>

      <WhatsAppModal
        open={whatsappModalOpen}
        onClose={() => {
          setWhatsappModalOpen(false);
          invalidate('channels', 'whatsapp');
        }}
      />
    </div>
  );
}

function ChannelsSkeleton() {
  return (
    <div className="w-full space-y-8 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  return (
    <Suspense fallback={<ChannelsSkeleton />}>
      <ChannelsInner />
    </Suspense>
  );
}
