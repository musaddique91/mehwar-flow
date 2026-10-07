'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Copy,
  ExternalLink,
  Flame,
  LayoutGrid,
  List,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { type SchedulerRunDto, type SchedulerType } from '@mehwar/shared';
import { Card, Button, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PlatformIcon } from '@/lib/platforms';

interface ExecutionHistoryViewerProps {
  runs: SchedulerRunDto[];
  onRefresh: () => void;
  loading?: boolean;
}

const TYPE_CONFIG: Record<
  SchedulerType,
  { label: string; icon: any; color: string; badge: string }
> = {
  CHANNEL_LIVENESS: {
    label: 'Channel Liveness Monitor',
    icon: ShieldCheck,
    color: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  COMMENT_ANALYSIS: {
    label: 'AI Comment Sentiment Sync',
    icon: Sparkles,
    color: 'text-purple-500',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  ORDER_DETECTION: {
    label: 'Order Lead Scanner',
    icon: ShoppingBag,
    color: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  CUSTOM: {
    label: 'Custom Scheduler',
    icon: Activity,
    color: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
};

const EMOTION_EMOJIS: Record<string, string> = {
  happy: '😊',
  excited: '🔥',
  question: '❓',
  neutral: '😐',
  angry: '😠',
  sad: '😢',
  curious: '💡',
  urgent: '⚡',
};

function formatDuration(ms?: number | null) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function ExecutionHistoryViewer({
  runs,
  onRefresh,
  loading = false,
}: ExecutionHistoryViewerProps) {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(
    runs.length > 0 ? runs[0].id : null,
  );
  const [showRawJson, setShowRawJson] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredRuns = runs.filter((r) => {
    if (selectedType !== 'ALL' && r.type !== selectedType) return false;
    if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedRunId((prev) => (prev === id ? null : id));
  };

  const copyJson = (id: string, details: any) => {
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopiedId(id);
    toast.success('Execution details copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!runs || runs.length === 0) {
    return (
      <Card className="text-center p-12 border-dashed border-line">
        <Activity className="size-12 text-muted mx-auto mb-3 opacity-40" />
        <h3 className="text-base font-bold text-fg">No Execution History Yet</h3>
        <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-4">
          Background schedulers execute on the worker or can be run on-demand from the Schedulers Hub.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar: Type Filter & Status Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-card-strong/60 border border-line">
        {/* Type Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'ALL', label: 'All Tasks' },
            { id: 'CHANNEL_LIVENESS', label: '🛡️ Liveness' },
            { id: 'ORDER_DETECTION', label: '🔥 Orders & Leads' },
            { id: 'COMMENT_ANALYSIS', label: '💬 AI Comments' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedType(t.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl font-semibold transition',
                selectedType === t.id
                  ? 'brand-gradient text-white shadow-xs'
                  : 'text-muted hover:text-fg hover:bg-elevated',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status Filter & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-card border border-line text-xs">
            {['ALL', 'SUCCESS', 'FAILED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-bold transition uppercase',
                  selectedStatus === st
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-fg',
                )}
              >
                {st}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            loading={loading}
            className="rounded-xl h-8 px-3 text-xs gap-1.5 font-medium"
          >
            <RefreshCw className="size-3" /> Refresh
          </Button>
        </div>
      </div>

      {/* Runs Count Summary */}
      <div className="flex items-center justify-between px-1 text-xs text-muted">
        <span>
          Showing <strong>{filteredRuns.length}</strong> of <strong>{runs.length}</strong> execution runs
        </span>
        <span className="text-[11px]">Click any run card to view full human-readable output</span>
      </div>

      {/* Runs List Cards */}
      <div className="space-y-3">
        {filteredRuns.map((run) => {
          const cfg = TYPE_CONFIG[run.type] || TYPE_CONFIG.CUSTOM;
          const Icon = cfg.icon;
          const isExpanded = expandedRunId === run.id;
          const isSuccess = run.status === 'SUCCESS';
          const isRunning = run.status === 'RUNNING';
          const details = run.details || {};
          const isRaw = showRawJson[run.id] ?? false;

          return (
            <Card
              key={run.id}
              className={cn(
                'border transition-all duration-200 overflow-hidden p-0 backdrop-blur-md',
                isExpanded
                  ? 'border-primary/50 shadow-lg bg-card'
                  : 'border-line/70 hover:border-line bg-card/60 hover:shadow-sm',
              )}
            >
              {/* Card Header Row (Clickable) */}
              <div
                onClick={() => toggleExpand(run.id)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-elevated/40 transition select-none"
              >
                {/* Left: Icon + Type + Summary */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div
                    className={cn(
                      'size-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs',
                      isSuccess
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : isRunning
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20',
                    )}
                  >
                    <Icon className="size-5" />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-fg text-sm">{cfg.label}</span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wide',
                          isSuccess
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : isRunning
                            ? 'bg-amber-500/15 text-amber-600 border-amber-500/20 animate-pulse'
                            : 'bg-rose-500/15 text-rose-600 border-rose-500/20',
                        )}
                      >
                        {isSuccess ? <CheckCircle2 className="size-3" /> : null}
                        {run.status}
                      </span>
                      <span className="text-[11px] text-muted">
                        • {new Date(run.startedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Summary snippet */}
                    <p className="text-xs text-muted truncate max-w-2xl font-normal">
                      {run.summary || 'Completed with telemetry data'}
                    </p>
                  </div>
                </div>

                {/* Right: Metrics & Expand Toggle */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className="text-right text-[11px] text-muted">
                    <span className="font-semibold text-fg">{run.itemsProcessed}</span> items •{' '}
                    <span>{formatDuration(run.durationMs)}</span>
                  </div>

                  <div className="size-7 rounded-xl bg-card-strong border border-line flex items-center justify-center text-muted">
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </div>
                </div>
              </div>

              {/* Expandable Beautiful Details View */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-line/80 bg-card-strong/30 p-5 space-y-4"
                  >
                    {/* Top Action Ribbon inside Expanded Panel */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line/60">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-fg">Result Summary:</span>
                        <span className="text-muted">{run.summary}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setShowRawJson((prev) => ({ ...prev, [run.id]: !isRaw }))
                          }
                          className="h-7 px-2.5 text-[11px] rounded-lg gap-1 text-muted hover:text-fg"
                        >
                          <Code className="size-3" />
                          {isRaw ? 'Show Friendly View' : 'Raw JSON'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyJson(run.id, details)}
                          className="h-7 px-2.5 text-[11px] rounded-lg gap-1"
                        >
                          {copiedId === run.id ? (
                            <>
                              <Check className="size-3 text-emerald-500" /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" /> Copy JSON
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Friendly Structured View OR Raw JSON View */}
                    {isRaw ? (
                      /* Raw JSON Code Block */
                      <div className="rounded-2xl bg-black/90 p-4 border border-zinc-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-80">
                        <pre>{JSON.stringify(details, null, 2)}</pre>
                      </div>
                    ) : (
                      /* Structured Friendly Output */
                      <div className="space-y-4">
                        {/* Error Callout if FAILED */}
                        {run.errorMessage && (
                          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                            <XCircle className="size-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Execution Error</p>
                              <p className="mt-0.5 font-mono text-[11px]">{run.errorMessage}</p>
                            </div>
                          </div>
                        )}

                        {/* CASE 1: CHANNEL_LIVENESS OUTPUT */}
                        {run.type === 'CHANNEL_LIVENESS' && (
                          <div className="space-y-3">
                            {/* Health Badges Bar */}
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-xs font-bold">
                                <CheckCircle2 className="size-3.5" />
                                {details.healthyCount ?? details.healthy ?? 0} Healthy Channels
                              </span>

                              {(details.needsReconnectCount ?? details.needsReconnect ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-bold animate-pulse">
                                  <AlertTriangle className="size-3.5" />
                                  {details.needsReconnectCount ?? details.needsReconnect} Requiring Reconnection
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-card-strong text-muted border border-line text-xs font-semibold">
                                  0 Connectivity Issues
                                </span>
                              )}
                            </div>

                            {/* Detailed Inspected Channels List */}
                            {Array.isArray(details.channels) && details.channels.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                                {details.channels.map((ch: any) => {
                                  const isHealthy = ch.status === 'ACTIVE';
                                  return (
                                    <div
                                      key={ch.id}
                                      className={cn(
                                        'p-3 rounded-2xl border text-xs flex items-center justify-between gap-3',
                                        isHealthy
                                          ? 'bg-card border-line/80'
                                          : 'bg-rose-500/5 border-rose-500/30 shadow-xs',
                                      )}
                                    >
                                      <div className="flex items-center gap-2.5 truncate">
                                        <PlatformIcon platform={ch.platform} className="size-4 shrink-0" />
                                        <div className="truncate">
                                          <p className="font-bold text-fg truncate">{ch.displayName}</p>
                                          <p className="text-[10px] text-muted truncate">
                                            {ch.platform} {ch.username ? `(@${ch.username})` : ''}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="shrink-0 flex items-center gap-2">
                                        {isHealthy ? (
                                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                                            Healthy
                                          </span>
                                        ) : (
                                          <div className="flex items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-500/15 text-rose-600 border border-rose-500/20">
                                              Needs Re-Auth
                                            </span>
                                            <Link href="/channels">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 px-2 text-[10px] rounded-lg gap-1 border-rose-500/30 text-rose-600"
                                              >
                                                Fix <ExternalLink className="size-2.5" />
                                              </Button>
                                            </Link>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* CASE 2: ORDER_DETECTION OUTPUT */}
                        {run.type === 'ORDER_DETECTION' && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-xs font-bold">
                                <Flame className="size-3.5" />
                                {details.newLeadsCount ?? details.openLeads ?? 0} Purchase Leads Captured
                              </span>
                            </div>

                            {/* Detected Leads Sample */}
                            {Array.isArray(details.detectedLeads) &&
                            details.detectedLeads.length > 0 ? (
                              <div className="space-y-2 pt-1">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                                  Captured Comments with Purchase Intent:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {details.detectedLeads.map((lead: any) => (
                                    <div
                                      key={lead.id}
                                      className="p-3.5 rounded-2xl bg-card border border-line space-y-2"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-fg text-xs">
                                          {lead.author}
                                        </span>
                                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-red-500/15 text-red-600 border border-red-500/20">
                                          {lead.priority || 'HIGH'}
                                        </span>
                                      </div>
                                      <p className="text-xs italic text-fg bg-card-strong p-2.5 rounded-xl border border-line/60">
                                        &ldquo;{lead.text}&rdquo;
                                      </p>
                                      <div className="flex items-center justify-between text-[11px] text-muted">
                                        <span className="font-semibold text-primary capitalize">
                                          {lead.intent?.replace('_', ' ') || 'Purchase'}
                                        </span>
                                        <Link href="/automation">
                                          <span className="text-primary hover:underline font-semibold cursor-pointer">
                                            View in Leads tab →
                                          </span>
                                        </Link>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted">
                                No new purchase leads detected during this execution. All active leads are tracked in the &quot;High-Priority Leads & Orders&quot; tab.
                              </p>
                            )}
                          </div>
                        )}

                        {/* CASE 3: COMMENT_ANALYSIS OUTPUT */}
                        {run.type === 'COMMENT_ANALYSIS' && (
                          <div className="space-y-4">
                            {/* Dominant Sentiment & Emotion Counts */}
                            <div className="flex flex-wrap items-center gap-2">
                              {details.dominantEmotion && (
                                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 text-xs font-bold uppercase">
                                  <span>{EMOTION_EMOJIS[details.dominantEmotion] || '✨'}</span>
                                  Dominant Mood: {details.dominantEmotion}
                                </span>
                              )}

                              {details.counts &&
                                Object.entries(details.counts).map(([emotion, count]) => {
                                  if (typeof count !== 'number' || count === 0) return null;
                                  return (
                                    <span
                                      key={emotion}
                                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-card text-muted border border-line text-[11px] font-semibold capitalize"
                                    >
                                      <span>{EMOTION_EMOJIS[emotion] || '•'}</span>
                                      {emotion}: <strong className="text-fg">{count}</strong>
                                    </span>
                                  );
                                })}
                            </div>

                            {/* Audience Summary Box */}
                            {details.summary && (
                              <div className="p-3.5 rounded-2xl bg-card border border-line/80">
                                <p className="text-xs font-semibold text-fg flex items-center gap-1.5 mb-1">
                                  <Sparkles className="size-3.5 text-primary" /> Audience Sentiment Summary
                                </p>
                                <p className="text-xs text-muted leading-relaxed">
                                  {details.summary}
                                </p>
                              </div>
                            )}

                            {/* Recommended Video / Content Suggestions */}
                            {Array.isArray(details.videoSuggestions) &&
                              details.videoSuggestions.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                                    AI-Derived Next Content Ideas:
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {details.videoSuggestions.map((sug: any, idx: number) => (
                                      <div
                                        key={sug.id || idx}
                                        className="p-3.5 rounded-2xl bg-card border border-line space-y-1.5"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="font-bold text-fg text-xs line-clamp-1">
                                            {sug.title}
                                          </p>
                                          <Badge className="shrink-0 text-[9px]">
                                            {sug.suggestedFormat || 'Content'}
                                          </Badge>
                                        </div>
                                        {sug.hook && (
                                          <p className="text-[11px] text-muted line-clamp-2 italic">
                                            &ldquo;{sug.hook}&rdquo;
                                          </p>
                                        )}
                                        {sug.reason && (
                                          <p className="text-[10px] text-primary/80 font-medium">
                                            Why: {sug.reason}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
