'use client';

import {
  BarChart2,
  Bookmark,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  Eye,
  Film,
  Flame,
  Heart,
  Info,
  Lightbulb,
  ListChecks,
  MessageCircleQuestion,
  MessageSquare,
  Plug,
  Plus,
  RefreshCw,
  Repeat2,
  Send,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  CommentAnalysisResultDto,
  PLATFORM_RULES,
  type ChannelDto,
  type Platform,
  VideoSuggestionDto,
} from '@mehwar/shared';
import { FadeIn } from '@/components/motion';
import { Button, Card, Modal, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { invalidate, useApi } from '@/lib/hooks';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

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

interface ChannelDetailsResponse {
  id: string;
  platform: Platform;
  status: string;
  displayName: string;
  username: string | null;
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

export default function ChannelDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const channels = useApi<ChannelDto[]>('/channels', ['channels']);
  const details = useApi<ChannelDetailsResponse>(`/channels/${id}/details`);
  const [videoFilter, setVideoFilter] = useState<'all' | 'shorts' | 'videos'>('all');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [busyDisconnect, setBusyDisconnect] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideoItem | null>(null);
  const [commentsList, setCommentsList] = useState<
    Array<{
      id: string;
      authorName: string;
      authorAvatarUrl: string | null;
      text: string;
      publishedAt: string;
      likeCount: number;
      replyCount?: number;
      replies?: Array<{
        id: string;
        authorName: string;
        authorAvatarUrl: string | null;
        text: string;
        publishedAt: string;
        likeCount: number;
      }>;
    }>
  >([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Post Actions State
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likingPost, setLikingPost] = useState<string | null>(null);
  const [retweetedPosts, setRetweetedPosts] = useState<Set<string>>(new Set());
  const [retweeting, setRetweeting] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<{ id: string; text: string; authorName: string } | null>(null);

  // AI Emotion & Video Suggestions State
  const [aiAnalysis, setAiAnalysis] = useState<CommentAnalysisResultDto | null>(null);
  const [analyzingComments, setAnalyzingComments] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<string>('all');
  const [activeAiTab, setActiveAiTab] = useState<'emotions' | 'suggestions'>('emotions');
  const [copiedSuggestionId, setCopiedSuggestionId] = useState<string | null>(null);
  const [savedSuggestionIds, setSavedSuggestionIds] = useState<Set<string>>(new Set());

  const channel = channels.data?.find((c) => c.id === id);
  const data = details.data;

  async function runAiAnalysis(sampleIfEmpty = false) {
    if (analyzingComments || !selectedVideo) return;
    setAnalyzingComments(true);
    try {
      const payloadComments = commentsList.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        text: c.text,
        publishedAt: c.publishedAt,
      }));

      const res = await api<CommentAnalysisResultDto>('/ai/analyze-comments', {
        method: 'POST',
        json: {
          comments: payloadComments,
          sampleIfEmpty,
          videoTitle: selectedVideo.title,
          videoDescription: selectedVideo.description,
        },
      });

      setAiAnalysis(res);
      if (res.videoSuggestions && res.videoSuggestions.length > 0) {
        setActiveAiTab('suggestions');
      }

      // If sample comments were loaded and commentsList was empty, populate commentsList as well
      if (commentsList.length === 0 && res.comments && res.comments.length > 0) {
        setCommentsList(
          res.comments.map((rc: any) => ({
            id: rc.id,
            authorName: rc.authorName,
            authorAvatarUrl: null,
            text: rc.text,
            publishedAt: rc.publishedAt || new Date().toISOString(),
            likeCount: Math.floor(Math.random() * 20) + 1,
            replyCount: 0,
            replies: [],
          })),
        );
      }
      toast.success(
        res.videoSuggestions && res.videoSuggestions.length > 0
          ? `Analyzed with NVIDIA AI! Found ${res.videoSuggestions.length} next video ideas from fan requests.`
          : `Comments categorized by emotion with NVIDIA AI!`,
      );
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to analyze comments');
    } finally {
      setAnalyzingComments(false);
    }
  }

  async function copyVideoPlan(sug: VideoSuggestionDto) {
    const fanQuotes =
      sug.fanRequests && sug.fanRequests.length > 0
        ? `\n### 💬 Fan Inspiration / Requests\n${sug.fanRequests.map((r) => `- ${r}`).join('\n')}\n`
        : '';
    const outlineText = sug.outline.map((pt, i) => `${i + 1}. ${pt}`).join('\n');
    const fullText = `# Suggested Video: ${sug.title}

> **Hook / Premise:** ${sug.hook}
> **Format:** ${sug.suggestedFormat} | **Demand Level:** ${sug.demandLevel}

### 💡 Why Make This Video (Audience Demand)
${sug.reason}
${fanQuotes}
### 📋 Proposed Video Outline
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
        ? `\n\nInspired by your comments: "${sug.fanRequests[0]}"`
        : '';
    const outlineBullets = sug.outline.map((pt) => `• ${pt}`).join('\n');
    const draft = `🎬 Working on our next video: "${sug.title}"

${sug.hook}${fanQuote}

Key topics we'll cover:
${outlineBullets}

What questions do you have about this? Drop them in the comments below! 👇`;

    router.push(`/dashboard?text=${encodeURIComponent(draft)}`);
    toast.success('Opening composer with video announcement draft!');
  }

  function toggleSaveSuggestion(id: string) {
    setSavedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info('Removed from saved video ideas');
      } else {
        next.add(id);
        toast.success('Saved video idea!');
      }
      return next;
    });
  }

  async function likePost(postId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (likingPost) return;
    setLikingPost(postId);
    try {
      await api(`/channels/${id}/videos/${postId}/like`, { method: 'POST' });
      setLikedPosts((prev) => new Set([...prev, postId]));
      toast.success('Liked!');
    } catch (err) {
      toast.error((err as ApiError).message || 'Could not like post');
    } finally {
      setLikingPost(null);
    }
  }

  async function retweetPost(postId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (retweeting) return;
    setRetweeting(postId);
    try {
      await api(`/channels/${id}/videos/${postId}/retweet`, { method: 'POST' });
      setRetweetedPosts((prev) => new Set([...prev, postId]));
      toast.success('Retweeted!');
    } catch (err) {
      toast.error((err as ApiError).message || 'Could not retweet');
    } finally {
      setRetweeting(null);
    }
  }

  async function deleteComment(commentId: string) {
    if (deletingCommentId || !selectedVideo) return;
    setDeletingCommentId(commentId);
    try {
      await api(`/channels/${id}/videos/${selectedVideo.id}/comments/${commentId}`, {
        method: 'DELETE',
      });
      setCommentsList((prev) => prev.filter((c) => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (err) {
      toast.error((err as ApiError).message || 'Could not delete comment');
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function openVideoDialog(v: YouTubeVideoItem) {
    setSelectedVideo(v);
    setLoadingComments(true);
    setCommentsList([]);
    setAiAnalysis(null);
    setSelectedEmotion('all');
    setReplyingToId(null);
    setReplyText('');
    setNewCommentText('');
    try {
      const comments = await api<any[]>(`/channels/${id}/videos/${v.id}/comments`);
      setCommentsList(comments);
    } catch (err) {
      toast.error('Could not load video comments');
    } finally {
      setLoadingComments(false);
    }
  }

  async function submitTopComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVideo || !newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      const created = await api<any>(`/channels/${id}/videos/${selectedVideo.id}/comments`, {
        method: 'POST',
        json: { text: newCommentText },
      });
      toast.success('Comment posted');
      setCommentsList((prev) => [created, ...prev]);
      setNewCommentText('');
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function submitReply(e: React.FormEvent, parentId: string) {
    e.preventDefault();
    if (!selectedVideo || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const created = await api<any>(`/channels/${id}/videos/${selectedVideo.id}/comments`, {
        method: 'POST',
        json: { parentId, text: replyText },
      });
      toast.success('Reply posted');
      setCommentsList((prev) =>
        prev.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), created] } : c)),
      );
      setReplyingToId(null);
      setReplyText('');
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  }

  async function disconnect() {
    setBusyDisconnect(true);
    try {
      await api(`/channels/${id}`, { method: 'DELETE' });
      toast.success(`${channel?.displayName ?? 'Channel'} disconnected`);
      invalidate('channels', 'posts');
      router.push('/channels');
    } catch (err) {
      toast.error((err as ApiError).message);
      setBusyDisconnect(false);
    }
  }

  const filteredVideos = (data?.videos ?? []).filter((v) => {
    if (videoFilter === 'shorts') return v.isShort;
    if (videoFilter === 'videos') return !v.isShort;
    return true;
  });

  const platform = (data?.platform ?? channel?.platform ?? 'youtube') as Platform;

  return (
    <div className="w-full space-y-6 pt-2">
      {/* Breadcrumb Navigation */}
      <FadeIn>
        <nav className="flex items-center gap-2 text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/channels" className="font-medium hover:text-fg transition">
            Channels
          </Link>
          <ChevronRight className="size-3.5 text-muted/60" />
          <span className="font-semibold text-fg">
            {data?.title || channel?.displayName || 'Channel Details'}
          </span>
        </nav>
      </FadeIn>

      {/* Main Channel Details Container */}
      <FadeIn delay={0.08}>
        {details.loading && !data ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        ) : details.error || (!data && !channel) ? (
          <Card className="p-8 text-center bg-card-strong">
            <CircleAlert className="size-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold">Channel Not Found</h2>
            <p className="mt-1 text-sm text-muted">
              This channel may have been disconnected or removed.
            </p>
            <Link href="/channels" className="mt-5 inline-block">
              <Button variant="secondary">Back to Channels</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Header Banner & Profile Info */}
            <div className="relative overflow-hidden rounded-3xl border border-line bg-card-strong p-6 shadow-sm">
              {data?.bannerUrl && (
                <div className="absolute inset-0 -z-10 opacity-25 blur-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.bannerUrl} alt="" className="size-full object-cover" />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <span
                      className="relative block size-20 rounded-full p-[2px] shadow-md"
                      style={{ background: PLATFORM_BRAND[platform]?.gradient }}
                    >
                      <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-elevated">
                        {data?.avatarUrl || channel?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={data?.avatarUrl || channel?.avatarUrl!}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <PlatformIcon platform={platform} className="size-9" />
                        )}
                      </span>
                    </span>
                    <span
                      className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg)] shadow-md"
                      style={{ background: PLATFORM_BRAND[platform]?.gradient }}
                      title={PLATFORM_RULES[platform]?.label}
                    >
                      <PlatformIcon platform={platform} className="size-3.5" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-black tracking-tight truncate">
                        {data?.title || channel?.displayName}
                      </h1>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          (channel?.status ?? data?.status) === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {(channel?.status ?? data?.status) === 'ACTIVE' ? (
                          <CircleCheck className="size-3.5" />
                        ) : (
                          <CircleAlert className="size-3.5" />
                        )}
                        {(channel?.status ?? data?.status) === 'ACTIVE' ? 'Active' : 'Needs Reconnecting'}
                      </span>
                    </div>

                    <p className="text-xs text-muted mt-1">
                      {PLATFORM_RULES[platform]?.label}{' '}
                      {data?.customUrl
                        ? `· ${data.customUrl}`
                        : channel?.username
                          ? `· @${channel.username}`
                          : ''}
                    </p>

                    {data?.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted max-w-2xl">
                        {data.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/settings?connect=${platform}`}>
                    <Button variant="secondary" size="sm">
                      <RefreshCw className="size-3.5" /> Reconnect
                    </Button>
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDisconnectModal(true)}
                  >
                    <Trash2 className="size-3.5" /> Disconnect
                  </Button>
                </div>
              </div>

              {/* Stats KPI Tiles */}
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-elevated/70 p-4 border border-line/70">
                   <div className="flex items-center justify-center gap-1.5 text-xs text-muted mb-1">
                    <Users className="size-4 text-primary" />
                    <span className="font-semibold">
                      {platform === 'youtube' ? 'Subscribers' : 'Followers'}
                    </span>
                  </div>
                  <p className="text-xl font-black">{formatNumber(data?.subscriberCount)}</p>
                </div>
                <div className="rounded-2xl bg-elevated/70 p-4 border border-line/70">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted mb-1">
                    <Eye className="size-4 text-blue-500" />
                    <span className="font-semibold">
                      {platform === 'youtube' || platform === 'tiktok' ? 'Total Views' : platform === 'x' ? 'Total Tweets' : 'Total Reach'}
                    </span>
                  </div>
                  <p className="text-xl font-black">{formatNumber(data?.viewCount)}</p>
                </div>
                <div className="rounded-2xl bg-elevated/70 p-4 border border-line/70">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted mb-1">
                    <Video className="size-4 text-emerald-500" />
                    <span className="font-semibold">
                      {platform === 'youtube' || platform === 'tiktok' ? 'Videos' : platform === 'x' ? 'Recent Posts' : 'Total Posts'}
                    </span>
                  </div>
                  <p className="text-xl font-black">{formatNumber(data?.videoCount)}</p>
                </div>
              </div>
            </div>

            {/* Content & Posts Section for All Platforms */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                  <BarChart2 className="size-4 text-primary" />{' '}
                  {platform === 'youtube'
                    ? `Channel Videos (${filteredVideos.length})`
                    : platform === 'facebook'
                      ? `Facebook Page Posts (${filteredVideos.length})`
                      : platform === 'instagram'
                        ? `Instagram Posts & Media (${filteredVideos.length})`
                        : platform === 'x'
                          ? `X / Twitter Posts (${filteredVideos.length})`
                          : platform === 'linkedin'
                            ? `LinkedIn Posts (${filteredVideos.length})`
                            : `Channel Posts (${filteredVideos.length})`}
                </h2>
                {platform === 'youtube' && (
                  <div className="flex gap-1 rounded-xl bg-elevated p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setVideoFilter('all')}
                      className={`rounded-lg px-3 py-1.5 font-medium transition ${
                        videoFilter === 'all'
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'text-muted hover:text-fg'
                      }`}
                    >
                      All Content
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoFilter('shorts')}
                      className={`rounded-lg px-3 py-1.5 font-medium transition ${
                        videoFilter === 'shorts'
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'text-muted hover:text-fg'
                      }`}
                    >
                      ⚡ Shorts
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoFilter('videos')}
                      className={`rounded-lg px-3 py-1.5 font-medium transition ${
                        videoFilter === 'videos'
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'text-muted hover:text-fg'
                      }`}
                    >
                      📹 Long Videos
                    </button>
                  </div>
                )}
              </div>

              {filteredVideos.length === 0 ? (
                platform === 'linkedin' ? (
                  <Card className="flex flex-col items-center justify-center p-8 text-center bg-card-strong space-y-4 border border-blue-500/20">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
                      <PlatformIcon platform="linkedin" className="size-7" />
                    </div>
                    <div className="max-w-md space-y-1.5">
                      <h3 className="font-bold text-lg text-fg">LinkedIn Publishing Connected</h3>
                      <p className="text-sm text-muted leading-relaxed">
                        Your LinkedIn profile is connected with the <b>Share on LinkedIn</b> API. Posts published or scheduled through Mehwar Flow will appear here with analytics and real-time comment tracking.
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3.5 max-w-lg text-left text-xs text-muted-foreground space-y-1.5">
                      <p className="font-semibold text-fg flex items-center gap-1.5">
                        <Info className="size-3.5 text-blue-400 shrink-0" /> Why don't my past LinkedIn posts show up automatically?
                      </p>
                      <p className="leading-relaxed text-[11px]">
                        LinkedIn's API policy grants standard developer applications write/publishing permissions (<code className="text-blue-400 font-mono">w_member_social</code>). Due to LinkedIn privacy restrictions, reading historical posts published directly on linkedin.com requires LinkedIn Enterprise Partner API approval.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <Link href="/dashboard#compose">
                        <Button className="gap-2">
                          <Plus className="size-4" /> Create First LinkedIn Post
                        </Button>
                      </Link>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const demoLinkedInPost: YouTubeVideoItem = {
                            id: 'li-demo-sample',
                            title: 'Announcing our new automated multi-platform social publisher 🚀',
                            description: 'Thrilled to share what we have been building! Centralized scheduling, instant cross-network publishing to LinkedIn, YouTube, X, and Instagram with built-in NVIDIA AI analytics.',
                            publishedAt: new Date().toISOString(),
                            thumbnailUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
                            views: 340,
                            likes: 42,
                            comments: 3,
                            duration: '0:00',
                            isShort: false,
                            url: 'https://www.linkedin.com/feed/',
                          };
                          openVideoDialog(demoLinkedInPost);
                        }}
                      >
                        <Sparkles className="size-4 mr-1 text-fuchsia-400" /> Preview Sample Post & AI Analysis
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Card className="py-12 text-center text-sm text-muted bg-card-strong">
                    No {videoFilter !== 'all' ? videoFilter : 'posts or media'} found for this channel.
                  </Card>
                )
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredVideos.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => openVideoDialog(v)}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card-strong transition hover:border-primary/50 hover:shadow-lg cursor-pointer"
                    >
                      {v.thumbnailUrl ? (
                        <div className="relative aspect-video w-full overflow-hidden bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={v.thumbnailUrl}
                            alt=""
                            className="size-full object-cover transition group-hover:scale-105"
                          />
                          {v.isShort && (
                            <span className="absolute left-2.5 top-2.5 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                              ⚡ SHORT
                            </span>
                          )}
                          {platform === 'instagram' && v.isShort && (
                            <span className="absolute left-2.5 top-2.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                              REEL
                            </span>
                          )}
                          {platform === 'x' && (
                            <span className="absolute left-2.5 top-2.5 rounded-md bg-black/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                              𝕏 Post
                            </span>
                          )}
                          {platform === 'facebook' && (
                            <span className="absolute left-2.5 top-2.5 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                              FB Post
                            </span>
                          )}
                          <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-mono text-white flex items-center gap-1">
                            <Video className="size-3 text-red-500" /> Play & Comments
                          </span>
                        </div>
                      ) : (
                        <div className="relative p-4 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border-b border-line/60 min-h-[90px] flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span
                              className="flex size-7 items-center justify-center rounded-lg text-white shadow-sm"
                              style={{ background: PLATFORM_BRAND[platform]?.gradient }}
                            >
                              <PlatformIcon platform={platform} className="size-3.5" />
                            </span>
                            <span className="text-[10px] font-medium text-muted">
                              {v.publishedAt
                                ? new Date(v.publishedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : ''}
                            </span>
                          </div>
                          {v.description && (
                            <p className="mt-2 text-xs text-muted line-clamp-2">{v.description}</p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <h3 className="line-clamp-2 text-sm font-semibold group-hover:text-primary transition">
                            {v.title}
                          </h3>
                          {v.description && v.description !== v.title && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted">
                              {v.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs text-muted border-t border-line/60 pt-3">
                          {v.views > 0 ? (
                            <span className="flex items-center gap-1 font-semibold text-fg">
                              <Eye className="size-3.5 text-blue-500" />
                              {formatNumber(v.views)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted">
                              {v.publishedAt
                                ? new Date(v.publishedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'Post'}
                            </span>
                          )}
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1" title="Likes">
                              <ThumbsUp className="size-3.5 text-red-500" />
                              {formatNumber(v.likes + (likedPosts.has(v.id) ? 1 : 0))}
                            </span>
                            <span className="flex items-center gap-1" title="Comments">
                              <MessageSquare className="size-3.5 text-emerald-500" />
                              {formatNumber(v.comments)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => likePost(v.id, e)}
                              disabled={likedPosts.has(v.id) || likingPost === v.id}
                              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                                likedPosts.has(v.id)
                                  ? 'text-red-500 bg-red-500/10'
                                  : 'text-muted hover:text-red-500 hover:bg-red-500/10'
                              }`}
                              title="Like post"
                            >
                              <Heart className={`size-3.5 ${likedPosts.has(v.id) ? 'fill-red-500 text-red-500' : ''}`} />
                              <span>{likedPosts.has(v.id) ? 'Liked' : 'Like'}</span>
                            </button>

                            {platform === 'x' && (
                              <button
                                type="button"
                                onClick={(e) => retweetPost(v.id, e)}
                                disabled={retweetedPosts.has(v.id) || retweeting === v.id}
                                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                                  retweetedPosts.has(v.id)
                                    ? 'text-emerald-500 bg-emerald-500/10'
                                    : 'text-muted hover:text-emerald-500 hover:bg-emerald-500/10'
                                }`}
                                title="Retweet"
                              >
                                <Repeat2 className="size-3.5" />
                                <span>{retweetedPosts.has(v.id) ? 'Retweeted' : 'Retweet'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </FadeIn>

      {/* Video & Comments Dialog – portalled to document.body so fixed positioning is always viewport-relative */}
      {selectedVideo && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5">
          {/* Click-away */}
          <div className="absolute inset-0" onClick={() => setSelectedVideo(null)} />

          {/* Panel */}
          <div
            className="relative z-10 flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-card-strong shadow-2xl"
            style={{ height: 'calc(100dvh - 40px)', maxHeight: '900px' }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-fg">{selectedVideo.title}</p>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted">
                  {selectedVideo.publishedAt && (
                    <span>{new Date(selectedVideo.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                  <span className="flex items-center gap-1"><Eye className="size-3 text-blue-500" />{formatNumber(selectedVideo.views)}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="size-3 text-red-500" />{formatNumber(selectedVideo.likes)}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="size-3 text-emerald-500" />{formatNumber(selectedVideo.comments)}</span>
                  <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 font-semibold text-primary hover:underline">
                    <ExternalLink className="size-3" /> Open
                  </a>
                </div>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="shrink-0 rounded-full p-2 text-muted transition hover:bg-line hover:text-fg"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body: player left, comments right — both independently scrollable */}
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              {/* Left – video player */}
              <div className="flex shrink-0 flex-col gap-3 overflow-y-auto border-b border-line p-4 lg:w-[60%] lg:border-b-0 lg:border-r">
                {platform === 'youtube' ? (
                  <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1`}
                      title={selectedVideo.title}
                      className="absolute inset-0 size-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : selectedVideo.thumbnailUrl ? (
                  <div className="relative w-full overflow-hidden rounded-xl bg-muted" style={{ paddingBottom: '56.25%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedVideo.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
                  </div>
                ) : null}
                {selectedVideo.description && (
                  <p className="text-xs text-muted line-clamp-4 whitespace-pre-line">{selectedVideo.description}</p>
                )}

                {/* AI Emotion & Sentiment Breakdown Section */}
                <div className="mt-2 rounded-2xl border border-line bg-elevated/60 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                        <Sparkles className="size-4 text-emerald-500 animate-pulse" />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
                          AI Emotion & Sentiment Analysis
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                            NVIDIA Llama 3.2
                          </span>
                        </h4>
                        <p className="text-[10px] text-muted">Classifies viewer vibe & suggests next video topics from fan requests</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={analyzingComments}
                        onClick={() => runAiAnalysis(false)}
                        className="text-xs h-7 px-2.5"
                      >
                        <Sparkles className="size-3 text-emerald-500" />
                        Analyze Comments
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        loading={analyzingComments}
                        onClick={() => runAiAnalysis(true)}
                        className="text-xs h-7 px-2.5 text-muted hover:text-fg border border-line/60"
                        title="Load test comments with happy, angry, sad, excited and question examples"
                      >
                        Load Test Samples
                      </Button>
                    </div>
                  </div>

                  {!aiAnalysis ? (
                    <div className="rounded-xl border border-line/60 bg-card-strong/40 p-3 text-xs text-muted flex items-start gap-2.5">
                      <Lightbulb className="size-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-fg text-[11px]">Need inspiration for your next video?</p>
                        <p className="text-[10px] mt-0.5 text-muted leading-relaxed">
                          Click <b className="text-fg">"Analyze Comments"</b> or <b className="text-fg">"Load Test Samples"</b>. NVIDIA AI will categorize audience sentiments and automatically detect fan questions, struggles, and requests to suggest high-impact video ideas.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {/* Sub-Tabs: Video Suggestions vs Emotion Analysis */}
                      <div className="flex items-center gap-1.5 border-b border-line/60 pb-2">
                        <button
                          type="button"
                          onClick={() => setActiveAiTab('suggestions')}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            activeAiTab === 'suggestions'
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-muted hover:text-fg hover:bg-card-strong/60'
                          }`}
                        >
                          <Lightbulb className="size-3.5 text-amber-300" />
                          <span>Next Video Ideas</span>
                          {aiAnalysis.videoSuggestions && aiAnalysis.videoSuggestions.length > 0 && (
                            <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                              activeAiTab === 'suggestions' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {aiAnalysis.videoSuggestions.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAiTab('emotions')}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            activeAiTab === 'emotions'
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-muted hover:text-fg hover:bg-card-strong/60'
                          }`}
                        >
                          <Sparkles className="size-3.5 text-emerald-400" />
                          <span>Audience Emotions</span>
                          <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                            activeAiTab === 'emotions' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {aiAnalysis.counts.total}
                          </span>
                        </button>
                      </div>

                      {/* Tab 1: Fan-Requested Video Suggestions */}
                      {activeAiTab === 'suggestions' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2 px-0.5">
                            <div>
                              <h5 className="text-[11px] font-bold text-fg flex items-center gap-1.5">
                                <Flame className="size-3.5 text-amber-500" />
                                Fan-Requested Video Topics
                              </h5>
                              <p className="text-[10px] text-muted">
                                Topics extracted from questions, requested tutorials & viewer struggles
                              </p>
                            </div>
                            <span className="text-[10px] text-muted font-semibold">
                              {aiAnalysis.videoSuggestions?.length ?? 0} ideas
                            </span>
                          </div>

                          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {aiAnalysis.videoSuggestions && aiAnalysis.videoSuggestions.length > 0 ? (
                              aiAnalysis.videoSuggestions.map((sug) => {
                                const isSaved = savedSuggestionIds.has(sug.id);
                                const isCopied = copiedSuggestionId === sug.id;
                                return (
                                  <div
                                    key={sug.id}
                                    className="rounded-xl border border-line bg-card-strong p-3 text-xs space-y-2.5 transition hover:border-line/80 shadow-sm"
                                  >
                                    {/* Badges & Save */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                                          <Film className="size-2.5" />
                                          {sug.suggestedFormat}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                          sug.demandLevel === 'High'
                                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                            : sug.demandLevel === 'Trending'
                                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        }`}>
                                          {sug.demandLevel === 'High' ? '🔥' : sug.demandLevel === 'Trending' ? '⚡' : '📈'} {sug.demandLevel} Demand
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => toggleSaveSuggestion(sug.id)}
                                        className={`rounded-lg p-1.5 transition ${
                                          isSaved ? 'text-amber-400 bg-amber-500/10' : 'text-muted hover:text-fg hover:bg-elevated'
                                        }`}
                                        title={isSaved ? 'Saved to ideas' : 'Save this video idea'}
                                      >
                                        <Bookmark className={`size-3.5 ${isSaved ? 'fill-current' : ''}`} />
                                      </button>
                                    </div>

                                    {/* Title & Hook */}
                                    <div>
                                      <h4 className="text-xs font-bold text-fg leading-snug">{sug.title}</h4>
                                      <p className="mt-1 text-[11px] text-muted italic leading-relaxed">
                                        "{sug.hook}"
                                      </p>
                                    </div>

                                    {/* Fan Requests & Rationale Callout */}
                                    <div className="rounded-lg border border-line/60 bg-elevated/80 p-2.5 space-y-1.5">
                                      {sug.fanRequests && sug.fanRequests.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="text-[10px] font-bold text-fg flex items-center gap-1">
                                            <MessageCircleQuestion className="size-3 text-purple-400" />
                                            What fans asked in comments:
                                          </p>
                                          {sug.fanRequests.map((req, rIdx) => (
                                            <div key={rIdx} className="flex items-start gap-1.5 text-[11px] text-muted pl-1">
                                              <span className="text-emerald-400 font-bold shrink-0">↳</span>
                                              <span className="italic text-fg/90">{req}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <p className="text-[10px] text-muted">
                                        <b className="text-fg">💡 Why make this:</b> {sug.reason}
                                      </p>
                                    </div>

                                    {/* Outline */}
                                    {sug.outline && sug.outline.length > 0 && (
                                      <div className="rounded-lg bg-card p-2 text-[11px] space-y-1 border border-line/40">
                                        <p className="text-[10px] font-bold text-muted flex items-center gap-1">
                                          <ListChecks className="size-3 text-emerald-400" />
                                          Suggested Video Outline:
                                        </p>
                                        <div className="grid grid-cols-1 gap-0.5 pl-1">
                                          {sug.outline.map((pt, pIdx) => (
                                            <div key={pIdx} className="flex items-baseline gap-1.5 text-fg/90 text-[11px]">
                                              <span className="text-[10px] font-bold text-muted">{pIdx + 1}.</span>
                                              <span>{pt}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Actions: Draft in Composer & Copy */}
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => draftInComposer(sug)}
                                        className="flex-1 text-[11px] h-7 gap-1.5"
                                      >
                                        <Send className="size-3" />
                                        Draft Post in Composer
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => copyVideoPlan(sug)}
                                        className="text-[11px] h-7 gap-1.5 px-3"
                                      >
                                        {isCopied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                                        {isCopied ? 'Copied' : 'Copy Plan'}
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="rounded-xl border border-line/60 bg-card-strong p-4 text-center text-xs text-muted">
                                No video suggestions generated yet. Click "Analyze Comments" or "Load Test Samples".
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Audience Emotions & Categorized Comments */}
                      {activeAiTab === 'emotions' && (
                        <div className="space-y-3">
                          {/* Summary Banner */}
                          <div className="rounded-xl bg-card-strong p-3 border border-line/60 text-xs">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-semibold text-fg text-[11px] flex items-center gap-1">
                                Audience Emotion Vibe
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                Dominant: {aiAnalysis.dominantEmotion}
                              </span>
                            </div>
                            <p className="text-muted leading-relaxed text-[11px]">{aiAnalysis.summary}</p>
                          </div>

                          {/* Emotion Category Pills */}
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { key: 'all', label: 'All', emoji: '🌟', count: aiAnalysis.counts.total },
                              { key: 'happy', label: 'Happy & Love', emoji: '😊', count: aiAnalysis.counts.happy },
                              { key: 'excited', label: 'Excited & Hyped', emoji: '🤩', count: aiAnalysis.counts.excited },
                              { key: 'angry', label: 'Angry & Critical', emoji: '😡', count: aiAnalysis.counts.angry },
                              { key: 'sad', label: 'Sad & Defeated', emoji: '😢', count: aiAnalysis.counts.sad },
                              { key: 'question', label: 'Questions', emoji: '❓', count: aiAnalysis.counts.question },
                              { key: 'neutral', label: 'Neutral', emoji: '😐', count: aiAnalysis.counts.neutral },
                            ].map((cat) => (
                              <button
                                key={cat.key}
                                type="button"
                                onClick={() => setSelectedEmotion(cat.key)}
                                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition border ${
                                  selectedEmotion === cat.key
                                    ? 'bg-card-strong border-primary text-fg shadow-sm'
                                    : 'bg-card-strong/40 border-line/60 text-muted hover:text-fg'
                                }`}
                              >
                                <span>{cat.emoji}</span>
                                <span>{cat.label}</span>
                                <span className="ml-1 rounded-full bg-elevated px-1.5 py-0.2 text-[9px] font-bold text-fg/80">
                                  {cat.count}
                                </span>
                              </button>
                            ))}
                          </div>

                          {/* Categorized Comments List Preview */}
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {aiAnalysis.comments
                              .filter((c) => selectedEmotion === 'all' || c.emotion === selectedEmotion)
                              .map((c) => (
                                <div
                                  key={c.id}
                                  className="rounded-xl border border-line/60 bg-card-strong p-2.5 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-fg text-[11px]">{c.authorName}</span>
                                    <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                      c.emotion === 'happy' ? 'bg-emerald-500/10 text-emerald-400' :
                                      c.emotion === 'excited' ? 'bg-amber-500/10 text-amber-400' :
                                      c.emotion === 'angry' ? 'bg-rose-500/10 text-rose-400' :
                                      c.emotion === 'sad' ? 'bg-blue-500/10 text-blue-400' :
                                      c.emotion === 'question' ? 'bg-purple-500/10 text-purple-400' :
                                      'bg-muted/10 text-muted'
                                    }`}>
                                      <span>{c.emoji}</span>
                                      <span>{c.emotion}</span>
                                    </span>
                                  </div>
                                  <p className="text-fg/90 text-[11px] leading-relaxed">{c.text}</p>
                                  {c.reason && (
                                    <p className="text-[10px] text-muted italic">💡 AI: {c.reason}</p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right – comments */}
              <div className="flex min-h-0 flex-1 flex-col lg:w-[40%]">
                {/* Comment input */}
                <form onSubmit={submitTopComment} className="shrink-0 border-b border-line p-4 space-y-2">
                  <p className="text-xs font-bold text-fg flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-emerald-500" />
                    Comments{commentsList.length > 0 ? ` (${commentsList.length})` : ''}
                  </p>
                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="w-full resize-none rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-fg placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={!newCommentText.trim() || submittingComment} loading={submittingComment}>
                      Post Comment
                    </Button>
                  </div>
                </form>

                {/* Active emotion filter banner */}
                {selectedEmotion !== 'all' && (
                  <div className="flex items-center justify-between border-b border-line/60 bg-primary/10 px-4 py-2 text-xs">
                    <span className="font-semibold text-primary flex items-center gap-1.5">
                      Filtering by emotion: <span className="capitalize">{selectedEmotion}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedEmotion('all')}
                      className="text-[11px] font-bold text-muted hover:text-fg underline"
                    >
                      Clear filter
                    </button>
                  </div>
                )}

                {/* Comment list – scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingComments ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full rounded-2xl" />
                      <Skeleton className="h-16 w-full rounded-2xl" />
                      <Skeleton className="h-16 w-full rounded-2xl" />
                    </div>
                  ) : commentsList.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-xs text-muted">
                      No comments yet. Click "Load Test Samples" to test AI emotion categorization!
                    </div>
                  ) : (
                    (() => {
                      const analyzedMap = new Map((aiAnalysis?.comments ?? []).map((ac) => [ac.id, ac]));
                      const filteredList = commentsList.filter((c) => {
                        if (selectedEmotion === 'all') return true;
                        const found = analyzedMap.get(c.id);
                        return found ? found.emotion === selectedEmotion : true;
                      });

                      if (filteredList.length === 0) {
                        return (
                          <div className="py-8 text-center text-xs text-muted">
                            No comments found with the "{selectedEmotion}" emotion.{' '}
                            <button
                              type="button"
                              onClick={() => setSelectedEmotion('all')}
                              className="text-primary hover:underline font-semibold"
                            >
                              Show all
                            </button>
                          </div>
                        );
                      }

                      return filteredList.map((comment) => {
                        const analyzed = analyzedMap.get(comment.id);
                        return (
                          <div key={comment.id} className="space-y-2 border-b border-line/50 pb-3 text-xs last:border-0">
                            <div className="flex items-start gap-2.5">
                              <div className="size-7 shrink-0 overflow-hidden rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-[10px]">
                                {comment.authorAvatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={comment.authorAvatarUrl} alt="" className="size-full object-cover" />
                                ) : (
                                  comment.authorName?.[0]?.toUpperCase() || 'U'
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-fg truncate">{comment.authorName}</span>
                                    {analyzed && (
                                      <span
                                        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                          analyzed.emotion === 'happy'
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : analyzed.emotion === 'excited'
                                              ? 'bg-amber-500/10 text-amber-400'
                                              : analyzed.emotion === 'angry'
                                                ? 'bg-rose-500/10 text-rose-400'
                                                : analyzed.emotion === 'sad'
                                                  ? 'bg-blue-500/10 text-blue-400'
                                                  : analyzed.emotion === 'question'
                                                    ? 'bg-purple-500/10 text-purple-400'
                                                    : 'bg-muted/10 text-muted'
                                        }`}
                                      >
                                        <span>{analyzed.emoji}</span>
                                        <span>{analyzed.emotion}</span>
                                      </span>
                                    )}
                                  </div>
                                  <span className="shrink-0 text-[10px] text-muted">
                                    {comment.publishedAt ? new Date(comment.publishedAt).toLocaleDateString() : ''}
                                  </span>
                                </div>
                                <p className="mt-1 text-fg/90 whitespace-pre-line leading-relaxed">{comment.text}</p>
                                {analyzed?.reason && (
                                  <p className="mt-1 text-[10px] text-muted italic">
                                    💡 AI: {analyzed.reason}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                                  <span className="flex items-center gap-1">
                                    <ThumbsUp className="size-3 text-red-500" /> {comment.likeCount}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                                    className="font-semibold text-primary hover:underline"
                                  >
                                    Reply
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCommentToDelete({
                                        id: comment.id,
                                        text: comment.text,
                                        authorName: comment.authorName,
                                      })
                                    }
                                    disabled={deletingCommentId === comment.id}
                                    className="font-semibold text-red-500 hover:underline disabled:opacity-50"
                                  >
                                    {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>

                            {replyingToId === comment.id && (
                              <form
                                onSubmit={(e) => submitReply(e, comment.id)}
                                className="mt-2 space-y-2 rounded-xl bg-elevated p-2.5 border border-line"
                              >
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder={`Replying to ${comment.authorName}...`}
                                  rows={2}
                                  className="w-full resize-none rounded-lg border border-line bg-card-strong px-2.5 py-1.5 text-xs text-fg placeholder:text-muted focus:border-primary focus:outline-none"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <Button type="button" variant="ghost" size="sm" onClick={() => setReplyingToId(null)}>Cancel</Button>
                                  <Button type="submit" size="sm" disabled={!replyText.trim() || submittingReply} loading={submittingReply}>Send Reply</Button>
                                </div>
                              </form>
                            )}

                            {comment.replies && comment.replies.length > 0 && (
                              <div className="mt-3 space-y-2.5 border-l-2 border-primary/30 pl-3">
                                {comment.replies.map((reply) => (
                                  <div key={reply.id} className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-fg text-[11px]">{reply.authorName}</span>
                                      <span className="text-[9px] text-muted">
                                        {reply.publishedAt ? new Date(reply.publishedAt).toLocaleDateString() : ''}
                                      </span>
                                    </div>
                                    <p className="text-fg/80 text-[11px] leading-relaxed">{reply.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Disconnect/Delete Channel Modal */}
      <Modal
        open={showDisconnectModal}
        onClose={() => !busyDisconnect && setShowDisconnectModal(false)}
        title="Delete channel?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to delete and disconnect <b className="text-fg">{data?.title || channel?.displayName}</b>?
          </p>
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-400">
            ⚠️ Scheduled posts targeted for this channel will be canceled. Published posts will remain on the platform.
          </div>
          <div className="mt-5 flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowDisconnectModal(false)} disabled={busyDisconnect}>
              Cancel
            </Button>
            <Button variant="danger" onClick={disconnect} loading={busyDisconnect}>
              Delete channel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Comment Confirmation Modal */}
      <Modal
        open={Boolean(commentToDelete)}
        onClose={() => !deletingCommentId && setCommentToDelete(null)}
        title="Delete comment?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to permanently delete this comment from YouTube?
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
              disabled={Boolean(deletingCommentId)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!commentToDelete) return;
                const cid = commentToDelete.id;
                await deleteComment(cid);
                setCommentToDelete(null);
              }}
              loading={Boolean(deletingCommentId)}
            >
              Delete comment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
