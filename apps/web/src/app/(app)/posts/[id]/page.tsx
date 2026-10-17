'use client';

import {
  CalendarClock,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  MessageSquareOff,
  RefreshCw,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_RULES, type Platform, type PostDto, type PostTargetDto } from '@mehwar/shared';
import { Avatar, Card, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import { PLATFORM_BRAND, PlatformIcon } from '@/lib/platforms';

/**
 * Networks whose API lets us read comments. For the others the API answers with sample comments,
 * which must never appear on a real post's page.
 */
const COMMENT_PLATFORMS = new Set<Platform>(['youtube', 'instagram', 'facebook', 'x', 'tiktok']);

interface CommentReply {
  id: string;
  authorName: string;
  authorAvatarUrl: string | null;
  text: string;
  publishedAt: string;
  likeCount: number;
}

interface VideoComment extends CommentReply {
  replyCount: number;
  replies: CommentReply[];
}

type TargetComments =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; comments: VideoComment[] };

function canReadComments(t: PostTargetDto) {
  return t.status === 'PUBLISHED' && Boolean(t.externalId) && COMMENT_PLATFORMS.has(t.platform);
}

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Loads comments for every published target in parallel; each channel resolves on its own. */
function useTargetComments(targets: PostTargetDto[] | undefined) {
  const [byTarget, setByTarget] = useState<Record<string, TargetComments>>({});
  const readable = useMemo(() => (targets ?? []).filter(canReadComments), [targets]);
  const key = readable.map((t) => `${t.id}:${t.externalId}`).join(',');

  const loadOne = useCallback(async (t: PostTargetDto) => {
    setByTarget((prev) => ({ ...prev, [t.id]: { state: 'loading' } }));
    try {
      const comments = await api<VideoComment[]>(
        `/channels/${t.channelId}/videos/${encodeURIComponent(t.externalId!)}/comments`,
      );
      setByTarget((prev) => ({
        ...prev,
        [t.id]: { state: 'ready', comments: Array.isArray(comments) ? comments : [] },
      }));
    } catch (err) {
      setByTarget((prev) => ({
        ...prev,
        [t.id]: { state: 'error', message: (err as ApiError).message || 'Could not load' },
      }));
    }
  }, []);

  const reload = useCallback(() => readable.forEach((t) => void loadOne(t)), [readable, loadOne]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { byTarget, readable, reload, reloadTarget: loadOne };
}

function MediaViewer({ post }: { post: PostDto }) {
  const [index, setIndex] = useState(0);
  const media = post.media[index];
  if (!media) return null;
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl bg-black">
        {media.kind === 'video' && media.url ? (
          <video
            key={media.id}
            src={media.url}
            poster={media.thumbnailUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="max-h-[70vh] w-full bg-black object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url ?? media.thumbnailUrl ?? ''}
            alt={media.fileName}
            className="max-h-[70vh] w-full object-contain"
          />
        )}
      </div>
      {post.media.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {post.media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                'size-16 shrink-0 overflow-hidden rounded-xl ring-2 transition',
                i === index ? 'ring-fuchsia-500' : 'ring-transparent opacity-70 hover:opacity-100',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.thumbnailUrl ?? m.url ?? ''} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelRow({
  target,
  comments,
  active,
  onSelect,
}: {
  target: PostTargetDto;
  comments: TargetComments | undefined;
  active: boolean;
  onSelect: () => void;
}) {
  const readable = canReadComments(target);
  const count = comments?.state === 'ready' ? comments.comments.length : null;
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3 transition',
        active ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-line',
      )}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: PLATFORM_BRAND[target.platform].gradient }}
      >
        <PlatformIcon platform={target.platform} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{target.channelName}</p>
        <p className="text-xs text-muted">
          {PLATFORM_RULES[target.platform].label} ·{' '}
          {target.status === 'PUBLISHED'
            ? target.publishedAt
              ? `Published ${timeAgo(target.publishedAt)}`
              : 'Published'
            : target.status.charAt(0) + target.status.slice(1).toLowerCase()}
        </p>
      </div>
      {readable && (
        <button
          type="button"
          onClick={onSelect}
          className="flex items-center gap-1 rounded-full bg-line/60 px-2.5 py-1 text-xs font-semibold transition hover:bg-line"
          title="Show this channel's comments"
        >
          {comments?.state === 'loading' ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <MessageCircle className="size-3" />
          )}
          {count ?? '–'}
        </button>
      )}
      {target.externalUrl && (
        <a
          href={target.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full p-1.5 text-muted transition hover:bg-line hover:text-fg"
          aria-label={`Open on ${PLATFORM_RULES[target.platform].label}`}
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  );
}

function CommentAvatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  if (!url) return <Avatar name={name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function CommentItem({
  comment,
  target,
  onReplied,
}: {
  comment: VideoComment;
  target: PostTargetDto;
  onReplied: () => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api(
        `/channels/${target.channelId}/videos/${encodeURIComponent(target.externalId!)}/comments`,
        { method: 'POST', json: { text: text.trim(), parentId: comment.id } },
      );
      toast.success(`Reply posted on ${PLATFORM_RULES[target.platform].label}`);
      setText('');
      setReplyOpen(false);
      onReplied();
    } catch (err) {
      toast.error('Reply failed', { description: (err as ApiError).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <li className="flex gap-3 py-4">
      <span className="relative h-fit">
        <CommentAvatar name={comment.authorName} url={comment.authorAvatarUrl} />
        <span
          className="absolute -bottom-1 -right-1 flex size-4.5 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg-elevated)]"
          style={{ background: PLATFORM_BRAND[target.platform].gradient }}
        >
          <PlatformIcon platform={target.platform} className="size-2.5" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">{comment.authorName}</span>
          <span className="text-xs text-muted">
            {target.channelName} · {timeAgo(comment.publishedAt)}
          </span>
        </p>
        {/* Some APIs (YouTube) return text with HTML entities; render as plain text. */}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">
          {decodeEntities(comment.text)}
        </p>
        <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-muted">
          <span className="flex items-center gap-1">
            <Heart className="size-3.5" /> {comment.likeCount}
          </span>
          <button type="button" onClick={() => setReplyOpen((o) => !o)} className="hover:text-fg">
            Reply
          </button>
          {comment.replies.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReplies((o) => !o)}
              className="text-fuchsia-600 hover:underline dark:text-fuchsia-300"
            >
              {showReplies ? 'Hide' : 'View'} {comment.replies.length}{' '}
              {comment.replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
        {showReplies && (
          <ul className="mt-3 space-y-3 border-l-2 border-line pl-4">
            {comment.replies.map((r) => (
              <li key={r.id} className="flex gap-2.5">
                <CommentAvatar name={r.authorName} url={r.authorAvatarUrl} size={28} />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{r.authorName}</span>{' '}
                    <span className="text-xs text-muted">{timeAgo(r.publishedAt)}</span>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">{decodeEntities(r.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {replyOpen && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-[var(--bg)] p-1.5 pl-3">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
              placeholder={`Reply to ${comment.authorName}…`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !text.trim()}
              className="brand-gradient flex size-8 items-center justify-center rounded-xl text-white disabled:opacity-50"
              aria-label="Send reply"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function decodeEntities(text: string) {
  if (!/&[#a-z0-9]+;|<br\s*\/?>/i.test(text)) return text;
  const el = document.createElement('textarea');
  el.innerHTML = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  return el.value;
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: post, error } = useApi<PostDto>(`/posts/${id}`, ['posts']);
  const { byTarget, readable, reload, reloadTarget } = useTargetComments(post?.targets);
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const merged = useMemo(() => {
    if (!post) return [];
    const rows: { comment: VideoComment; target: PostTargetDto }[] = [];
    for (const t of readable) {
      if (channelFilter !== 'all' && channelFilter !== t.id) continue;
      const c = byTarget[t.id];
      if (c?.state === 'ready') c.comments.forEach((comment) => rows.push({ comment, target: t }));
    }
    return rows.sort(
      (a, b) =>
        new Date(b.comment.publishedAt).getTime() - new Date(a.comment.publishedAt).getTime(),
    );
  }, [post, readable, byTarget, channelFilter]);

  const anyLoading = readable.some((t) => byTarget[t.id]?.state === 'loading');
  const errors = readable.filter((t) => byTarget[t.id]?.state === 'error');
  const unsupported = post?.targets.filter(
    (t) => t.status === 'PUBLISHED' && !COMMENT_PLATFORMS.has(t.platform),
  );
  const total = readable.reduce((n, t) => {
    const c = byTarget[t.id];
    return n + (c?.state === 'ready' ? c.comments.length : 0);
  }, 0);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl pt-10 text-center">
        <p className="text-lg font-bold">Post not found</p>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
        <Link href="/dashboard" className="mt-4 inline-block font-semibold text-fuchsia-500">
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pt-2">
      {!post ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              {post.media.length > 0 && <MediaViewer post={post} />}
              <Card>
                {post.scheduledAt && user && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                    <CalendarClock className="size-3.5" />
                    {new Date(post.scheduledAt).toLocaleString(undefined, {
                      timeZone: user.timezone,
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  {post.text || <span className="italic text-muted">No text</span>}
                </p>
              </Card>
            </div>

            <aside className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
                Posted to {post.targets.length} channel{post.targets.length === 1 ? '' : 's'}
              </h2>
              {post.targets.map((t) => (
                <ChannelRow
                  key={t.id}
                  target={t}
                  comments={byTarget[t.id]}
                  active={channelFilter === t.id}
                  onSelect={() => setChannelFilter((f) => (f === t.id ? 'all' : t.id))}
                />
              ))}
            </aside>
          </div>

          <Card className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                Comments
                <span className="rounded-full bg-line/70 px-2 py-0.5 text-xs font-bold">{total}</span>
              </h2>
              <div className="flex items-center gap-2">
                {readable.length > 1 && (
                  <div className="no-scrollbar flex gap-1 overflow-x-auto">
                    {[{ id: 'all', label: 'All channels' }, ...readable.map((t) => ({ id: t.id, label: t.channelName, platform: t.platform }))].map(
                      (opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setChannelFilter(opt.id)}
                          className={cn(
                            'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                            channelFilter === opt.id
                              ? 'brand-gradient text-white'
                              : 'border border-line text-muted hover:text-fg',
                          )}
                        >
                          {'platform' in opt && (
                            <PlatformIcon platform={opt.platform as Platform} className="size-3" />
                          )}
                          <span className="max-w-28 truncate">{opt.label}</span>
                        </button>
                      ),
                    )}
                  </div>
                )}
                {readable.length > 0 && (
                  <button
                    type="button"
                    onClick={reload}
                    disabled={anyLoading}
                    className="rounded-full p-2 text-muted transition hover:bg-line hover:text-fg disabled:opacity-50"
                    aria-label="Refresh comments"
                  >
                    <RefreshCw className={cn('size-4', anyLoading && 'animate-spin')} />
                  </button>
                )}
              </div>
            </div>

            {errors.map((t) => (
              <p key={t.id} className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">
                <b>{t.channelName}:</b>{' '}
                {(byTarget[t.id] as { message: string }).message}{' '}
                <button type="button" onClick={() => void reloadTarget(t)} className="underline">
                  Retry
                </button>
              </p>
            ))}

            {readable.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center text-muted">
                <MessageSquareOff className="size-8" />
                <p className="mt-2 text-sm font-semibold">No comments to show yet</p>
                <p className="mt-1 max-w-sm text-xs">
                  Comments appear here once the post is published to YouTube, Instagram, Facebook,
                  X or TikTok.
                </p>
              </div>
            ) : merged.length === 0 && anyLoading ? (
              <div className="space-y-4 py-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : merged.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No comments yet.</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {merged.map(({ comment, target }) => (
                  <CommentItem
                    key={`${target.id}:${comment.id}`}
                    comment={comment}
                    target={target}
                    onReplied={() => void reloadTarget(target)}
                  />
                ))}
              </ul>
            )}

            {unsupported && unsupported.length > 0 && (
              <p className="border-t border-line/60 pt-3 text-xs text-muted">
                Comments from{' '}
                {[...new Set(unsupported.map((t) => PLATFORM_RULES[t.platform].label))].join(', ')}{' '}
                can’t be read through their API yet. Open the post there to see them.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
