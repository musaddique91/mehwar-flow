'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Layers,
  Play,
  RotateCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Sliders,
  X,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type SchedulerConfigDto,
  type UpdateSchedulerConfigDto,
  type ChannelDto,
} from '@mehwar/shared';
import { Card, Button, Switch, Modal, Badge } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { useApi, invalidate } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { PlatformIcon } from '@/lib/platforms';

const PRESET_INTERVALS = [
  { label: '15 Min', value: 15 },
  { label: '30 Min', value: 30 },
  { label: '1 Hour', value: 60 },
  { label: '2 Hours', value: 120 },
  { label: '6 Hours', value: 360 },
  { label: '12 Hours', value: 720 },
  { label: '24 Hours', value: 1440 },
];

function formatInterval(mins: number) {
  if (mins < 60) return `${mins}m`;
  if (mins % 60 === 0) return `${mins / 60}h`;
  return `${mins}m`;
}

function formatRelativeTime(dateStr?: string | null) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getSchedulerIcon(type: string) {
  switch (type) {
    case 'CHANNEL_LIVENESS':
      return ShieldCheck;
    case 'COMMENT_ANALYSIS':
      return Sparkles;
    case 'ORDER_DETECTION':
      return ShoppingBag;
    default:
      return Sliders;
  }
}

function getSchedulerGradient(type: string) {
  switch (type) {
    case 'CHANNEL_LIVENESS':
      return 'from-blue-500/20 via-sky-500/10 to-transparent border-blue-500/30 text-blue-500';
    case 'COMMENT_ANALYSIS':
      return 'from-purple-500/20 via-fuchsia-500/10 to-transparent border-purple-500/30 text-purple-500';
    case 'ORDER_DETECTION':
      return 'from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30 text-amber-500';
    default:
      return 'from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30 text-emerald-500';
  }
}

export function SchedulersManager({
  compact = false,
  onRunComplete,
}: {
  compact?: boolean;
  onRunComplete?: () => void;
}) {
  const { data: schedulers, loading, refetch } = useApi<SchedulerConfigDto[]>(
    '/automation/schedulers',
    ['schedulers'],
  );
  const { data: channels } = useApi<ChannelDto[]>('/channels', ['channels']);

  const [runningId, setRunningId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<SchedulerConfigDto | null>(null);
  const [editInterval, setEditInterval] = useState<number>(60);
  const [editEnabled, setEditEnabled] = useState<boolean>(true);
  const [editChannelIds, setEditChannelIds] = useState<string[]>([]);
  const [editKeywords, setEditKeywords] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleRunNow = async (scheduler: SchedulerConfigDto) => {
    if (runningId) return;
    setRunningId(scheduler.id);
    try {
      const res = await api<any>(`/automation/schedulers/${scheduler.id}/run`, {
        method: 'POST',
      });
      toast.success(`Ran ${scheduler.name}!`, {
        description: res.summary || 'Completed successfully',
      });
      invalidate('schedulers', 'automation', 'notifications');
      refetch();
      onRunComplete?.();
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to trigger scheduler run');
    } finally {
      setRunningId(null);
    }
  };

  const openConfigModal = (scheduler: SchedulerConfigDto) => {
    setEditingConfig(scheduler);
    setEditInterval(scheduler.intervalMinutes);
    setEditEnabled(scheduler.enabled);
    setEditChannelIds(scheduler.channelIds || []);
    const kws = scheduler.options?.urgentKeywords || [];
    setEditKeywords(Array.isArray(kws) ? kws.join(', ') : '');
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;
    setSaving(true);
    try {
      const updatedOptions = { ...editingConfig.options };
      if (editingConfig.type === 'ORDER_DETECTION' && editKeywords.trim()) {
        updatedOptions.urgentKeywords = editKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);
      }

      await api<SchedulerConfigDto>(`/automation/schedulers/${editingConfig.id}`, {
        method: 'PATCH',
        json: {
          enabled: editEnabled,
          intervalMinutes: editInterval,
          channelIds: editChannelIds,
          options: updatedOptions,
        },
      });

      toast.success('Scheduler settings saved!');
      invalidate('schedulers', 'automation');
      refetch();
      setEditingConfig(null);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to update scheduler');
    } finally {
      setSaving(false);
    }
  };

  const toggleChannelSelection = (channelId: string) => {
    setEditChannelIds((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId],
    );
  };

  if (loading && !schedulers) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-64 rounded-3xl border border-line bg-card/50 animate-pulse p-6"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schedulers Grid */}
      <div className={cn('grid grid-cols-1 gap-4', compact ? 'md:grid-cols-2' : 'lg:grid-cols-3')}>
        {(schedulers || []).map((scheduler) => {
          const Icon = getSchedulerIcon(scheduler.type);
          const gradient = getSchedulerGradient(scheduler.type);
          const isRunning = runningId === scheduler.id || scheduler.lastStatus === 'RUNNING';

          return (
            <Card
              key={scheduler.id}
              className={cn(
                'relative flex flex-col justify-between overflow-hidden border border-line/80 bg-gradient-to-b p-6 backdrop-blur-xl transition-all duration-300 hover:border-line hover:shadow-xl',
                gradient,
                !scheduler.enabled && 'opacity-65 grayscale-[30%]',
              )}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 dark:bg-black/20 border border-white/20 shadow-sm backdrop-blur-md">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-fg leading-tight">
                        {scheduler.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                            scheduler.enabled
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-500/15 text-zinc-500 border border-zinc-500/20',
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              scheduler.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400',
                            )}
                          />
                          {scheduler.enabled ? 'Active' : 'Disabled'}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
                          <Clock className="size-3" />
                          Every {formatInterval(scheduler.intervalMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted leading-relaxed line-clamp-3 mb-4">
                  {scheduler.description}
                </p>

                {/* Target Channels Badge */}
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted">Channels:</span>
                  {scheduler.channelIds && scheduler.channelIds.length > 0 ? (
                    scheduler.channelIds.map((cid) => {
                      const ch = channels?.find((c) => c.id === cid);
                      return (
                        <span
                          key={cid}
                          className="inline-flex items-center gap-1 rounded-full bg-card-strong px-2 py-0.5 text-[11px] text-fg border border-line"
                        >
                          {ch ? <PlatformIcon platform={ch.platform} className="size-3" /> : null}
                          {ch?.displayName || 'Channel'}
                        </span>
                      );
                    })
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
                      All Connected ({channels?.length || 0})
                    </span>
                  )}
                </div>

                {/* Last Result Summary Box */}
                {scheduler.lastResultSummary && (
                  <div className="mb-4 rounded-2xl bg-card-strong/80 p-3 border border-line/60 text-[11px] text-muted">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-fg flex items-center gap-1">
                        <Activity className="size-3 text-primary" /> Last Run Result
                      </span>
                      <span className="text-[10px]">
                        {formatRelativeTime(scheduler.lastRunAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-fg/80">{scheduler.lastResultSummary}</p>
                  </div>
                )}
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-line/50 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openConfigModal(scheduler)}
                  className="rounded-xl px-3 py-1.5 text-xs h-8 border-line/70 gap-1.5 font-medium"
                >
                  <Settings2 className="size-3.5" /> Configure
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  loading={isRunning}
                  disabled={isRunning || !scheduler.enabled}
                  onClick={() => handleRunNow(scheduler)}
                  className="rounded-xl px-4 py-1.5 text-xs h-8 gap-1.5 shadow-sm"
                >
                  <Play className="size-3 fill-current" />
                  {isRunning ? 'Running...' : 'Run Now'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Scheduler Configuration Modal */}
      {editingConfig && (
        <Modal
          open={!!editingConfig}
          onClose={() => setEditingConfig(null)}
          title={`Configure ${editingConfig.name}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-5 pt-1">
            {/* Enabled / Disabled Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-card-strong border border-line">
              <div>
                <p className="text-sm font-bold text-fg">Enable Background Automation</p>
                <p className="text-xs text-muted">
                  Runs automatically on the background worker according to schedule.
                </p>
              </div>
              <Switch
                checked={editEnabled}
                onChange={setEditEnabled}
                label="Toggle Scheduler Active"
              />
            </div>

            {/* Interval Configuration */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
                Execution Interval
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PRESET_INTERVALS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setEditInterval(p.value)}
                    className={cn(
                      'rounded-xl py-2 px-2 text-xs font-semibold border transition text-center',
                      editInterval === p.value
                        ? 'brand-gradient text-white border-transparent shadow-sm'
                        : 'bg-card-strong border-line text-muted hover:text-fg hover:bg-elevated',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">Or custom minutes:</span>
                <input
                  type="number"
                  min="5"
                  max="10080"
                  value={editInterval}
                  onChange={(e) => setEditInterval(Math.max(5, parseInt(e.target.value, 10) || 5))}
                  className="w-24 rounded-xl border border-line bg-card-strong px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-muted">minutes ({Math.round(editInterval / 60 * 10) / 10} hours)</span>
              </div>
            </div>

            {/* Target Channels Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted block">
                  Target Channels
                </label>
                <button
                  type="button"
                  onClick={() => setEditChannelIds([])}
                  className={cn(
                    'text-[11px] font-semibold transition',
                    editChannelIds.length === 0 ? 'text-primary' : 'text-muted hover:text-fg',
                  )}
                >
                  All Channels (Default)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto no-scrollbar p-1">
                {(channels || []).map((ch) => {
                  const isSelected = editChannelIds.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChannelSelection(ch.id)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-2xl p-2.5 text-left border text-xs transition',
                        isSelected
                          ? 'border-primary bg-primary/10 text-fg font-semibold shadow-xs'
                          : 'border-line bg-card-strong text-muted hover:text-fg hover:bg-elevated',
                      )}
                    >
                      <PlatformIcon platform={ch.platform} className="size-4" />
                      <div className="truncate flex-1">
                        <p className="truncate font-medium">{ch.displayName}</p>
                        <p className="text-[10px] text-muted truncate">{ch.platform}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type-Specific Options */}
            {editingConfig.type === 'ORDER_DETECTION' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-1.5">
                  Purchase Lead Intent Keywords (Comma-separated)
                </label>
                <textarea
                  rows={3}
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  placeholder="buy, want, order, price, cost, how much, بكم, أبي, شراء, طلب"
                  className="w-full rounded-2xl border border-line bg-card-strong p-3 text-xs text-fg focus:outline-none focus:border-primary resize-none placeholder:text-muted/60"
                />
                <p className="text-[11px] text-muted mt-1">
                  Comments matching these phrases are prioritized as high-value sales inquiries.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingConfig(null)}
                className="rounded-xl px-4 text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={handleSaveConfig}
                className="rounded-xl px-5 text-xs h-9 shadow-md"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
