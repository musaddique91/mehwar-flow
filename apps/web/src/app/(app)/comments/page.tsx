'use client';

import {
  Check,
  Copy,
  ExternalLink,
  Film,
  Filter,
  Flame,
  Heart,
  Lightbulb,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsUp,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_RULES, type ChannelDto, type Platform, VideoSuggestionDto } from '@mehwar/shared';
import { FadeIn } from '@/components/motion';
import { Button, Card, Modal, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

interface AggregatedComment {
  id: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  text: string;
  publishedAt?: string | null;
  likeCount: number;
  replyCount?: number;
  replies?: Array<{
    id: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    text: string;
    publishedAt?: string | null;
  }>;
  channelId: string;
  channelName: string;
  channelUsername?: string | null;
  channelAvatarUrl?: string | null;
  platform: Platform;
  video: {
    id: string;
    title: string;
    description?: string;
    thumbnail?: string | null;
    url?: string;
    publishedAt?: string;
  };
}

interface CommentsApiResponse {
  channels: ChannelDto[];
  comments: AggregatedComment[];
  isSample: boolean;
}

interface AiCommentAnalysis {
  id: string;
  emotion: 'happy' | 'excited' | 'angry' | 'sad' | 'question' | 'neutral';
  emoji: string;
  reason: string;
}

interface AiAnalysisResult {
  summary: string;
  dominantEmotion: string;
  counts: {
    happy: number;
    excited: number;
    angry: number;
    sad: number;
    question: number;
    neutral: number;
    total: number;
  };
  comments: AiCommentAnalysis[];
  videoSuggestions?: VideoSuggestionDto[];
}

export default function CommentsPage() {
  const router = useRouter();
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('all');
  const [copiedSuggestionId, setCopiedSuggestionId] = useState<string | null>(null);

  // Video preview modal state
  const [previewVideo, setPreviewVideo] = useState<{
    id: string;
    title: string;
    description?: string;
    thumbnail?: string | null;
    url?: string;
    platform: Platform;
    channelName: string;
  } | null>(null);

  // Reply states
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Like & delete states
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<AggregatedComment | null>(null);

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [analyzingComments, setAnalyzingComments] = useState(false);

  // Local comments list override for optimistic updates
  const [localComments, setLocalComments] = useState<AggregatedComment[] | null>(null);

  async function copyVideoPlan(sug: VideoSuggestionDto) {
    const outlineText = sug.outline.map((pt, i) => `${i + 1}. ${pt}`).join('\n');
    const fanQuotes =
      sug.fanRequests && sug.fanRequests.length > 0
        ? `\n### 💬 Fan Inspiration\n${sug.fanRequests.map((r) => `- ${r}`).join('\n')}\n`
        : '';
    const fullText = `# Suggested Video: ${sug.title}

> **Hook:** ${sug.hook}
> **Format:** ${sug.suggestedFormat} | **Demand:** ${sug.demandLevel}

### 💡 Why Make This Video
${sug.reason}
${fanQuotes}
### 📋 Outline
${outlineText}
`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedSuggestionId(sug.id);
      toast.success('Video topic & outline copied to clipboard!');
      setTimeout(() => setCopiedSuggestionId(null), 2500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  function draftInComposer(sug: VideoSuggestionDto) {
    const fanQuote =
      sug.fanRequests && sug.fanRequests.length > 0
        ? `\n\nInspired by comments: "${sug.fanRequests[0]}"`
        : '';
    const outlineBullets = sug.outline.map((pt) => `• ${pt}`).join('\n');
    const draft = `🎬 Working on our next video: "${sug.title}"

${sug.hook}${fanQuote}

Key topics:
${outlineBullets}

What questions do you have? Drop them below! 👇`;

    router.push(`/dashboard?text=${encodeURIComponent(draft)}`);
    toast.success('Opening composer with video announcement draft!');
  }

  const queryUrl =
    selectedChannelId === 'all'
      ? '/channels/all-comments'
      : `/channels/all-comments?channelId=${selectedChannelId}`;

  const { data, loading, error, refetch } = useApi<CommentsApiResponse>(queryUrl, [
    'comments',
  ]);

  const activeComments = localComments ?? data?.comments ?? [];
  const channels = data?.channels ?? [];

  // Reset local list when remote data changes
  const commentsToDisplay = localComments ?? data?.comments ?? [];

  const analyzedMap = useMemo(() => {
    return new Map((aiAnalysis?.comments ?? []).map((ac) => [ac.id, ac]));
  }, [aiAnalysis]);

  // Filtering
  const filteredComments = useMemo(() => {
    return commentsToDisplay.filter((c) => {
      // Channel filter
      if (selectedChannelId !== 'all' && c.channelId !== selectedChannelId) return false;

      // Platform filter
      if (platformFilter !== 'all' && c.platform !== platformFilter) return false;

      // Emotion filter
      if (selectedEmotion !== 'all') {
        const analyzed = analyzedMap.get(c.id);
        if (analyzed && analyzed.emotion !== selectedEmotion) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText = c.text.toLowerCase().includes(q);
        const matchesAuthor = c.authorName.toLowerCase().includes(q);
        const matchesVideo = c.video.title.toLowerCase().includes(q);
        if (!matchesText && !matchesAuthor && !matchesVideo) return false;
      }

      return true;
    });
  }, [commentsToDisplay, selectedChannelId, platformFilter, selectedEmotion, searchQuery, analyzedMap]);

  async function runAiAnalysis() {
    if (analyzingComments) return;
    if (commentsToDisplay.length === 0) {
      toast.info('No comments found to analyze.');
      return;
    }
    setAnalyzingComments(true);
    try {
      const payload = commentsToDisplay.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        text: c.text,
        publishedAt: c.publishedAt ?? undefined,
      }));

      const res = await api<AiAnalysisResult>('/ai/analyze-comments', {
        method: 'POST',
        json: { comments: payload, sampleIfEmpty: false },
      });

      setAiAnalysis(res);
      toast.success('AI emotion categorization complete!');
    } catch (err) {
      toast.error((err as ApiError).message || 'AI analysis failed');
    } finally {
      setAnalyzingComments(false);
    }
  }

  // Handle comment reply
  async function handleReply(comment: AggregatedComment, e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);

    try {
      await api(`/channels/${comment.channelId}/videos/${comment.video.id}/comments`, {
        method: 'POST',
        json: { text: replyText.trim(), parentId: comment.id },
      });

      // Optimistically add reply
      const updated = commentsToDisplay.map((c) => {
        if (c.id === comment.id) {
          const newReplies = [
            ...(c.replies ?? []),
            {
              id: `temp-${Date.now()}`,
              authorName: 'You',
              text: replyText.trim(),
              publishedAt: new Date().toISOString(),
            },
          ];
          return { ...c, replies: newReplies, replyCount: newReplies.length };
        }
        return c;
      });

      setLocalComments(updated);
      setReplyingToId(null);
      setReplyText('');
      toast.success('Reply sent successfully!');
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  }

  // Handle delete comment
  async function handleDeleteComment(comment: AggregatedComment) {
    if (deletingId) return;
    setDeletingId(comment.id);
    try {
      await api(
        `/channels/${comment.channelId}/videos/${comment.video.id}/comments/${comment.id}`,
        { method: 'DELETE' },
      );
      setLocalComments((prev) => (prev ?? commentsToDisplay).filter((c) => c.id !== comment.id));
      toast.success('Comment deleted');
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to delete comment');
    } finally {
      setDeletingId(null);
    }
  }

  // Toggle like
  function toggleLike(id: string) {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-500 shadow-sm border border-fuchsia-500/20">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-fg">Unified Comments Inbox</h1>
                <p className="text-xs text-muted">
                  Monitor, filter, and respond to viewer comments across all your connected social channels in one place.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runAiAnalysis}
              loading={analyzingComments}
              className="gap-1.5 border-fuchsia-500/30 text-fuchsia-500 hover:bg-fuchsia-500/10"
            >
              <Sparkles className="size-3.5" />
              {aiAnalysis ? 'Re-analyze Emotions' : 'AI Emotion Analysis'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLocalComments(null);
                refetch();
              }}
              className="gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* AI Emotion Breakdown Banner (When Analyzed) */}
      {aiAnalysis && (
        <FadeIn>
          <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-500/10 via-purple-500/5 to-transparent p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-fuchsia-500 text-white text-[11px]">
                    ✨
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">
                    AI Emotion Insights
                  </span>
                  <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300">
                    Dominant: {aiAnalysis.dominantEmotion.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-fg/90">{aiAnalysis.summary}</p>
              </div>

              {/* Emotion Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: 'All', emoji: '🌟', count: aiAnalysis.counts.total },
                  { key: 'happy', label: 'Happy', emoji: '😍', count: aiAnalysis.counts.happy },
                  { key: 'excited', label: 'Excited', emoji: '🔥', count: aiAnalysis.counts.excited },
                  { key: 'angry', label: 'Angry', emoji: '😡', count: aiAnalysis.counts.angry },
                  { key: 'sad', label: 'Sad', emoji: '😢', count: aiAnalysis.counts.sad },
                  { key: 'question', label: 'Questions', emoji: '❓', count: aiAnalysis.counts.question },
                  { key: 'neutral', label: 'Neutral', emoji: '💬', count: aiAnalysis.counts.neutral },
                ].map((emo) => (
                  <button
                    key={emo.key}
                    type="button"
                    onClick={() => setSelectedEmotion(emo.key)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      selectedEmotion === emo.key
                        ? 'bg-fuchsia-500 text-white shadow-sm'
                        : 'bg-elevated text-muted hover:text-fg hover:bg-line border border-line/60'
                    }`}
                  >
                    <span>{emo.emoji}</span>
                    <span>{emo.label}</span>
                    <span className="rounded-full bg-black/20 px-1 py-0.2 text-[9px]">{emo.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* AI Next Video Ideas (From Fan Requests) */}
      {aiAnalysis?.videoSuggestions && aiAnalysis.videoSuggestions.length > 0 && (
        <FadeIn>
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                  <Flame className="size-4 text-amber-500" />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
                    Next Video Ideas from Fan Comments
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-400">
                      NVIDIA AI
                    </span>
                  </h4>
                  <p className="text-[10px] text-muted">
                    High-demand video concepts based on viewer questions & requests in the comments
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                {aiAnalysis.videoSuggestions.length} Topic Suggestions
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiAnalysis.videoSuggestions.map((sug) => {
                const isCopied = copiedSuggestionId === sug.id;
                return (
                  <div
                    key={sug.id}
                    className="flex flex-col justify-between rounded-xl border border-line bg-card-strong p-3 text-xs space-y-2.5 transition hover:border-line/80 shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                          <Film className="size-2.5" />
                          {sug.suggestedFormat}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            sug.demandLevel === 'High'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : sug.demandLevel === 'Trending'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {sug.demandLevel === 'High' ? '🔥' : sug.demandLevel === 'Trending' ? '⚡' : '📈'}{' '}
                          {sug.demandLevel}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-fg leading-snug">{sug.title}</h4>
                      <p className="text-[11px] text-muted italic">"{sug.hook}"</p>

                      {sug.fanRequests && sug.fanRequests.length > 0 && (
                        <div className="rounded-lg border border-line/60 bg-elevated/70 p-2 space-y-1">
                          <p className="text-[10px] font-bold text-fg">💬 Fan Request:</p>
                          <p className="text-[10px] text-muted italic line-clamp-2">
                            "{sug.fanRequests[0]}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-line/50">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => draftInComposer(sug)}
                        className="flex-1 text-[10px] h-6 gap-1"
                      >
                        <Send className="size-2.5" />
                        Draft Post
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => copyVideoPlan(sug)}
                        className="text-[10px] h-6 gap-1 px-2.5"
                      >
                        {isCopied ? <Check className="size-2.5 text-emerald-400" /> : <Copy className="size-2.5" />}
                        {isCopied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Control Bar: Account filter, platform filter, search */}
      <Card className="p-4 space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-center">
          {/* Account Filter Dropdown */}
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Filter by Account
            </label>
            <div className="relative">
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold text-fg focus:border-primary focus:outline-none transition cursor-pointer"
              >
                <option value="all">All Connected Accounts ({channels.length})</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {PLATFORM_RULES[ch.platform]?.label ?? ch.platform}: {ch.displayName || ch.username}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Platform Pills Filter */}
          <div className="sm:col-span-5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Platform
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPlatformFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  platformFilter === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-elevated text-muted hover:text-fg'
                }`}
              >
                All
              </button>
              {(['youtube', 'x', 'facebook', 'instagram'] as Platform[]).map((p) => {
                const count = commentsToDisplay.filter((c) => c.platform === p).length;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatformFilter(p)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      platformFilter === p
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-elevated text-muted hover:text-fg'
                    }`}
                  >
                    <PlatformIcon platform={p} className="size-3" />
                    <span>{PLATFORM_RULES[p]?.label ?? p}</span>
                    {count > 0 && <span className="opacity-75 text-[10px]">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Input */}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search text, author, video..."
                className="w-full rounded-xl border border-line bg-card pl-8 pr-3 py-1.5 text-xs text-fg placeholder:text-muted focus:border-primary focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-muted">
          <span>
            Showing <strong className="text-fg">{filteredComments.length}</strong> of{' '}
            <strong className="text-fg">{commentsToDisplay.length}</strong> real comments
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
            Live sync active
          </span>
        </div>
      </Card>

      {/* Comments List */}
      <div className="space-y-4">
        {loading && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : commentsToDisplay.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20">
              <MessageSquare className="size-7" />
            </div>
            <h3 className="mt-4 text-base font-bold text-fg">No comments found on your channels yet</h3>
            <p className="mt-1 text-xs text-muted max-w-md">
              We connected to your accounts across YouTube, Facebook, Instagram, X, and LinkedIn. When viewers post comments on your videos or posts, they will appear here in real time.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocalComments(null);
                refetch();
              }}
              className="mt-4 gap-1.5 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/10"
            >
              <RefreshCw className="size-3.5" />
              Check for New Comments
            </Button>
          </Card>
        ) : filteredComments.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="size-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-fg">No comments match your filters</h3>
            <p className="mt-1 text-xs text-muted max-w-sm">
              Try adjusting your account filter, platform selection, or search query.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedChannelId('all');
                setPlatformFilter('all');
                setSelectedEmotion('all');
                setSearchQuery('');
              }}
              className="mt-4"
            >
              Reset Filters
            </Button>
          </Card>
        ) : (
          filteredComments.map((comment) => {
            const analyzed = analyzedMap.get(comment.id);
            const isLiked = likedComments.has(comment.id);

            return (
              <Card
                key={comment.id}
                className="overflow-hidden border border-line/70 hover:border-line transition shadow-sm"
              >
                {/* Source Video / Post Context Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-elevated/60 px-4 py-2.5 border-b border-line/50 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Video / Post Thumbnail */}
                    <div
                      onClick={() =>
                        setPreviewVideo({
                          id: comment.video.id,
                          title: comment.video.title,
                          description: comment.video.description,
                          thumbnail: comment.video.thumbnail,
                          url: comment.video.url,
                          platform: comment.platform,
                          channelName: comment.channelName,
                        })
                      }
                      className="group relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-black/40 border border-line/60"
                      title="Click to preview video"
                    >
                      {comment.video.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={comment.video.thumbnail}
                          alt=""
                          className="size-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="size-full flex items-center justify-center text-white"
                          style={{ background: PLATFORM_BRAND[comment.platform]?.gradient }}
                        >
                          <PlatformIcon platform={comment.platform} className="size-4" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                        <Play className="size-3 fill-white text-white" />
                      </div>
                    </div>

                    {/* Source Video Title & Link */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewVideo({
                              id: comment.video.id,
                              title: comment.video.title,
                              description: comment.video.description,
                              thumbnail: comment.video.thumbnail,
                              url: comment.video.url,
                              platform: comment.platform,
                              channelName: comment.channelName,
                            })
                          }
                          className="font-semibold text-fg hover:text-primary transition truncate max-w-md text-left text-xs"
                        >
                          {comment.video.title}
                        </button>
                        {comment.video.url && (
                          <a
                            href={comment.video.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-muted hover:text-primary transition shrink-0"
                            title="Open original video link"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>

                      {/* Account attribution */}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted">
                        <span className="flex items-center gap-1">
                          <PlatformIcon platform={comment.platform} className="size-3" />
                          <span className="font-medium text-fg/80">{comment.channelName}</span>
                        </span>
                        {comment.channelUsername && (
                          <span className="text-[10px] opacity-75">{comment.channelUsername}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date & Direct Channel Link */}
                  <div className="flex items-center gap-2 text-[11px] text-muted shrink-0">
                    <span>
                      {comment.publishedAt
                        ? new Date(comment.publishedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                    <Link
                      href={`/channels/${comment.channelId}`}
                      className="rounded-md border border-line bg-card px-2 py-0.5 text-[10px] font-medium text-fg hover:border-primary transition"
                    >
                      View Channel
                    </Link>
                  </div>
                </div>

                {/* Comment Body */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className="size-8 shrink-0 overflow-hidden rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                      {comment.authorAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={comment.authorAvatarUrl} alt="" className="size-full object-cover" />
                      ) : (
                        comment.authorName[0]?.toUpperCase() || 'U'
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-fg text-xs">{comment.authorName}</span>

                          {/* AI Emotion Badge */}
                          {analyzed && (
                            <span
                              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                analyzed.emotion === 'happy'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                  : analyzed.emotion === 'excited'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                    : analyzed.emotion === 'angry'
                                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                      : analyzed.emotion === 'sad'
                                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                        : analyzed.emotion === 'question'
                                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                                          : 'bg-muted/15 text-muted border border-muted/20'
                              }`}
                            >
                              <span>{analyzed.emoji}</span>
                              <span>{analyzed.emotion}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-fg leading-relaxed whitespace-pre-line">
                        {comment.text}
                      </p>

                      {/* AI Reasoning Note */}
                      {analyzed?.reason && (
                        <p className="mt-1 text-[11px] text-muted italic">
                          💡 AI: {analyzed.reason}
                        </p>
                      )}

                      {/* Comment Actions: Like, Reply, Delete */}
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                        <button
                          type="button"
                          onClick={() => toggleLike(comment.id)}
                          className={`flex items-center gap-1 transition ${
                            isLiked ? 'text-red-500 font-semibold' : 'hover:text-red-500'
                          }`}
                        >
                          <ThumbsUp className={`size-3.5 ${isLiked ? 'fill-red-500' : ''}`} />
                          <span>{comment.likeCount + (isLiked ? 1 : 0)}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setReplyingToId(replyingToId === comment.id ? null : comment.id)
                          }
                          className="font-semibold text-primary hover:underline"
                        >
                          Reply
                        </button>

                        <button
                          type="button"
                          onClick={() => setCommentToDelete(comment)}
                          disabled={deletingId === comment.id}
                          className="font-semibold text-red-500 hover:underline disabled:opacity-50"
                        >
                          {deletingId === comment.id ? 'Deleting...' : 'Delete'}
                        </button>

                        {comment.replies && comment.replies.length > 0 && (
                          <span className="text-[11px] text-muted">
                            {comment.replies.length}{' '}
                            {comment.replies.length === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                      </div>

                      {/* Inline Reply Form */}
                      {replyingToId === comment.id && (
                        <form
                          onSubmit={(e) => handleReply(comment, e)}
                          className="mt-3 space-y-2 rounded-xl bg-elevated p-3 border border-line"
                        >
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply as ${comment.channelName}...`}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-fg placeholder:text-muted focus:border-primary focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingToId(null);
                                setReplyText('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              disabled={!replyText.trim() || submittingReply}
                              loading={submittingReply}
                            >
                              Send Reply
                            </Button>
                          </div>
                        </form>
                      )}

                      {/* Nested Replies Thread */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-3 space-y-2 border-l-2 border-primary/30 pl-3">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="space-y-0.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-fg text-[11px]">
                                  {reply.authorName}
                                </span>
                                <span className="text-[10px] text-muted">
                                  {reply.publishedAt
                                    ? new Date(reply.publishedAt).toLocaleDateString()
                                    : ''}
                                </span>
                              </div>
                              <p className="text-fg/90 text-xs">{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Video Preview Modal */}
      <Modal
        open={Boolean(previewVideo)}
        onClose={() => setPreviewVideo(null)}
        title={previewVideo?.title ?? 'Video Preview'}
        maxWidth="max-w-2xl"
      >
        {previewVideo && (
          <div className="space-y-4">
            {previewVideo.platform === 'youtube' ? (
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lg">
                <iframe
                  src={`https://www.youtube.com/embed/${previewVideo.id}?autoplay=1`}
                  title={previewVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="size-full border-0"
                />
              </div>
            ) : previewVideo.thumbnail ? (
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black/50 border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewVideo.thumbnail}
                  alt={previewVideo.title}
                  className="size-full object-cover"
                />
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={previewVideo.platform} className="size-4" />
                  <span className="font-bold text-fg text-sm">{previewVideo.channelName}</span>
                </div>
                {previewVideo.url && (
                  <a
                    href={previewVideo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1 text-xs font-semibold text-fg hover:border-primary transition"
                  >
                    Open on {PLATFORM_RULES[previewVideo.platform]?.label ?? 'Platform'}
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>

              {previewVideo.description && (
                <p className="mt-3 text-xs text-muted leading-relaxed whitespace-pre-line">
                  {previewVideo.description}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Comment Confirmation Modal */}
      <Modal
        open={Boolean(commentToDelete)}
        onClose={() => !deletingId && setCommentToDelete(null)}
        title="Delete comment?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to permanently delete this comment?
          </p>
          {commentToDelete && (
            <div className="rounded-xl border border-line bg-card/60 p-3 text-xs text-muted line-clamp-4 italic">
              <span className="font-semibold text-fg not-italic block mb-1">
                {commentToDelete.authorName}:
              </span>
              &ldquo;{commentToDelete.text}&rdquo;
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCommentToDelete(null)}
              disabled={Boolean(deletingId)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!commentToDelete) return;
                const target = commentToDelete;
                await handleDeleteComment(target);
                setCommentToDelete(null);
              }}
              loading={Boolean(deletingId)}
            >
              Delete comment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
