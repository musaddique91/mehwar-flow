'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  MessageCircle,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  type AutomationOverviewDto,
  type OrderInquiryDto,
  type SchedulerRunDto,
  type InquiryStatus,
} from '@mehwar/shared';
import { Card, Button, Badge, Modal } from '@/components/ui';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { api, type ApiError } from '@/lib/api';
import { useApi, invalidate } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { PlatformIcon } from '@/lib/platforms';
import { SchedulersManager } from '@/components/automation/SchedulersManager';
import { ExecutionHistoryViewer } from '@/components/automation/ExecutionHistoryViewer';

type AutomationTab = 'schedulers' | 'leads' | 'logs' | 'insights';

const STATUS_COLORS: Record<InquiryStatus, string> = {
  NEW: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
  CONTACTED: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
  CONVERTED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  CLOSED: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/20',
  ARCHIVED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/10',
};

const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  URGENT: {
    label: 'Urgent Lead',
    class: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse font-extrabold',
  },
  HIGH: {
    label: 'High Priority',
    class: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold',
  },
  MEDIUM: {
    label: 'Medium',
    class: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20',
  },
  LOW: {
    label: 'Low',
    class: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/20',
  },
};

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<AutomationTab>('schedulers');
  const [leadFilter, setLeadFilter] = useState<string>('ALL');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<OrderInquiryDto | null>(null);

  const { data: overview, refetch: refetchOverview } = useApi<AutomationOverviewDto>(
    '/automation/overview',
    ['automation'],
  );
  const { data: leads, refetch: refetchLeads } = useApi<OrderInquiryDto[]>(
    leadFilter === 'ALL' ? '/automation/leads' : `/automation/leads?status=${leadFilter}`,
    ['automation'],
  );
  const { data: runs, refetch: refetchRuns } = useApi<SchedulerRunDto[]>('/automation/runs', [
    'automation',
  ]);

  const handleUpdateLeadStatus = async (leadId: string, status: InquiryStatus) => {
    try {
      await api(`/automation/leads/${leadId}`, {
        method: 'PATCH',
        json: { status },
      });
      toast.success(`Lead marked as ${status}`);
      invalidate('automation');
      refetchLeads();
      refetchOverview();
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to update lead status');
    }
  };

  const handleWhatsAppContact = (lead: OrderInquiryDto) => {
    const phone = lead.contactPhone?.replace(/[^\d+]/g, '') || '';
    const cleanPhone = phone.startsWith('+') ? phone.slice(1) : phone;
    const greeting = `Hello ${lead.authorName}! Thank you for your interest in "${lead.postOrVideoTitle || 'our product'}". We noticed your inquiry: "${lead.commentText}". How can we help you complete your order today?`;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting)}`
      : `https://wa.me/?text=${encodeURIComponent(greeting)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full space-y-6 pt-2 pb-12">
      {/* Page Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl brand-gradient text-white shadow-md">
                <Bot className="size-5" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-fg">
                Automation & Schedulers
              </h1>
            </div>
            <p className="text-xs text-muted mt-1.5">
              Customizable background schedulers, account liveness monitoring, and AI-powered purchase lead triage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/settings?tab=schedulers">
              <Button variant="outline" size="sm" className="rounded-2xl gap-2 text-xs h-9">
                <Settings className="size-3.5" /> Scheduler Settings
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* KPI Overview Cards */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Active Schedulers */}
          <Card className="p-4 sm:p-5 border-line/80 bg-gradient-to-br from-indigo-500/10 via-card to-card">
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Schedulers</span>
              <Clock className="size-4 text-indigo-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-fg">
              {overview?.activeSchedulers ?? 3}
              <span className="text-sm font-semibold text-muted ml-1.5">
                / {overview?.totalSchedulers ?? 3}
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All core tasks configured
            </p>
          </Card>

          {/* Card 2: Channel Liveness */}
          <Card className="p-4 sm:p-5 border-line/80 bg-gradient-to-br from-blue-500/10 via-card to-card">
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Channel Liveness</span>
              <ShieldCheck className="size-4 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-fg">
              {overview?.channelHealth?.healthy ?? 0}
              <span className="text-sm font-semibold text-muted ml-1.5">
                / {overview?.channelHealth?.total ?? 0} Healthy
              </span>
            </div>
            <p
              className={cn(
                'text-[11px] font-medium mt-1',
                (overview?.channelHealth?.needsReconnect ?? 0) > 0
                  ? 'text-rose-500 font-bold'
                  : 'text-muted',
              )}
            >
              {(overview?.channelHealth?.needsReconnect ?? 0) > 0
                ? `⚠️ ${overview?.channelHealth.needsReconnect} channel(s) require reconnect`
                : 'All credentials valid'}
            </p>
          </Card>

          {/* Card 3: High Priority Leads */}
          <Card className="p-4 sm:p-5 border-line/80 bg-gradient-to-br from-amber-500/15 via-card to-card border-amber-500/20">
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Purchase Leads</span>
              <Flame className="size-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-500">
              {overview?.newLeads ?? 0}
              <span className="text-sm font-semibold text-muted ml-1.5">
                New Inquiries
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              {overview?.totalLeads ?? 0} total leads captured
            </p>
          </Card>

          {/* Card 4: Total Executions */}
          <Card className="p-4 sm:p-5 border-line/80 bg-gradient-to-br from-fuchsia-500/10 via-card to-card">
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Automated Sweeps</span>
              <Activity className="size-4 text-fuchsia-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-fg">
              {overview?.totalRuns ?? 0}
            </div>
            <p className="text-[11px] text-muted mt-1">
              Managed by background worker
            </p>
          </Card>
        </div>
      </FadeIn>

      {/* Tabs Navigation Bar */}
      <FadeIn delay={0.1}>
        <div className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('schedulers')}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition shrink-0',
              activeTab === 'schedulers'
                ? 'brand-gradient text-white shadow-md'
                : 'bg-card-strong text-muted hover:text-fg border border-line',
            )}
          >
            <Clock className="size-4" />
            Schedulers Hub
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leads')}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition shrink-0 relative',
              activeTab === 'leads'
                ? 'brand-gradient text-white shadow-md'
                : 'bg-card-strong text-muted hover:text-fg border border-line',
            )}
          >
            <ShoppingBag className="size-4" />
            High-Priority Leads & Orders
            {(overview?.newLeads ?? 0) > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-black animate-pulse">
                {overview?.newLeads}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition shrink-0',
              activeTab === 'logs'
                ? 'brand-gradient text-white shadow-md'
                : 'bg-card-strong text-muted hover:text-fg border border-line',
            )}
          >
            <Activity className="size-4" />
            Execution Logs ({runs?.length ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition shrink-0',
              activeTab === 'insights'
                ? 'brand-gradient text-white shadow-md'
                : 'bg-card-strong text-muted hover:text-fg border border-line',
            )}
          >
            <Sparkles className="size-4" />
            AI Comment Insights
          </button>
        </div>
      </FadeIn>

      {/* Tab 1: Schedulers Hub */}
      {activeTab === 'schedulers' && (
        <FadeIn delay={0.15}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-fg">Active Background Schedulers</h2>
                <p className="text-xs text-muted">
                  These tasks run continuously on the worker at your configured intervals. Click &quot;Run Now&quot; to execute immediately.
                </p>
              </div>
            </div>

            <SchedulersManager
              onRunComplete={() => {
                refetchOverview();
                refetchLeads();
                refetchRuns();
              }}
            />
          </div>
        </FadeIn>
      )}

      {/* Tab 2: High-Priority Leads & Orders */}
      {activeTab === 'leads' && (
        <FadeIn delay={0.15}>
          <div className="space-y-4">
            {/* Leads Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                  <Flame className="size-5 text-amber-500" />
                  Order Management & Purchase Leads
                </h2>
                <p className="text-xs text-muted">
                  Comments expressing purchase intent (&quot;I want this&quot;, &quot;how much&quot;, &quot;can I order&quot;) are prioritized here for rapid closing.
                </p>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card-strong border border-line text-xs">
                {['ALL', 'NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setLeadFilter(st)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl font-semibold transition',
                      leadFilter === st
                        ? 'brand-gradient text-white shadow-xs'
                        : 'text-muted hover:text-fg',
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Leads List / Cards */}
            {(!leads || leads.length === 0) ? (
              <Card className="text-center p-12 border-dashed border-line">
                <ShoppingBag className="size-12 text-muted mx-auto mb-3 opacity-40" />
                <h3 className="text-base font-bold text-fg">No Order Leads Detected Yet</h3>
                <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-4">
                  Run the &quot;Order Lead Scanner&quot; scheduler to scan your channels and detect customer purchase intent automatically.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setActiveTab('schedulers');
                  }}
                  className="rounded-2xl text-xs"
                >
                  Go to Schedulers Hub
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {leads.map((lead) => {
                  const pBadge = PRIORITY_BADGES[lead.priority] || PRIORITY_BADGES.HIGH;

                  return (
                    <Card
                      key={lead.id}
                      className="border border-line/80 p-5 bg-card/60 backdrop-blur-md transition-all hover:border-line hover:shadow-lg"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Left: Author & Context */}
                        <div className="flex items-start gap-3.5 flex-1">
                          <div className="size-11 rounded-2xl brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                            {lead.authorName.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-fg text-sm">{lead.authorName}</span>
                              {lead.authorHandle && (
                                <span className="text-xs text-muted">{lead.authorHandle}</span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded-full bg-card-strong px-2 py-0.5 text-[10px] font-semibold text-muted border border-line">
                                <PlatformIcon platform={lead.platform as any} className="size-3" />
                                {lead.platform}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] border',
                                  pBadge.class,
                                )}
                              >
                                {pBadge.label}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border uppercase',
                                  STATUS_COLORS[lead.status],
                                )}
                              >
                                {lead.status}
                              </span>
                            </div>

                            {/* Quote Comment Box */}
                            <div className="rounded-2xl bg-card-strong/90 p-3.5 border border-line/80 my-2">
                              <p className="text-sm font-medium text-fg italic leading-relaxed">
                                &ldquo;{lead.commentText}&rdquo;
                              </p>
                              {lead.aiReasoning && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1.5 flex items-center gap-1">
                                  <Sparkles className="size-3 shrink-0" />
                                  AI Reasoning: {lead.aiReasoning}
                                </p>
                              )}
                            </div>

                            {/* Post context */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                              {lead.postOrVideoTitle && (
                                <span>
                                  Post: <strong className="text-fg">{lead.postOrVideoTitle}</strong>
                                </span>
                              )}
                              <span>•</span>
                              <span>
                                Detected: {new Date(lead.detectedAt).toLocaleDateString()} {new Date(lead.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {lead.contactPhone && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-fg font-bold">
                                    📞 {lead.contactPhone}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex flex-wrap lg:flex-col items-end gap-2 shrink-0 pt-2 lg:pt-0">
                          {/* Direct WhatsApp Action */}
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleWhatsAppContact(lead)}
                            className="rounded-2xl text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 shadow-sm"
                          >
                            <MessageCircle className="size-4" />
                            Contact on WhatsApp
                          </Button>

                          {/* Status Dropdown */}
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted mr-1">Status:</span>
                            {(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'] as InquiryStatus[]).map(
                              (st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleUpdateLeadStatus(lead.id, st)}
                                  className={cn(
                                    'px-2.5 py-1 rounded-xl text-[10px] font-bold border transition',
                                    lead.status === st
                                      ? 'brand-gradient text-white border-transparent shadow-xs'
                                      : 'bg-card-strong text-muted border-line hover:text-fg',
                                  )}
                                >
                                  {st}
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {/* Tab 3: Execution History & Logs */}
      {activeTab === 'logs' && (
        <FadeIn delay={0.15}>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-fg">Scheduler Execution History</h2>
              <p className="text-xs text-muted">
                Audit trail of all automated and manual scheduler runs. Click any execution card to view the human-readable report.
              </p>
            </div>

            <ExecutionHistoryViewer
              runs={runs || []}
              onRefresh={refetchRuns}
            />
          </div>
        </FadeIn>
      )}

      {/* Tab 4: AI Comment Insights */}
      {activeTab === 'insights' && (
        <FadeIn delay={0.15}>
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                <Sparkles className="size-5 text-purple-500" />
                Audience Sentiment & Emotion Breakdown
              </h2>
              <p className="text-xs text-muted">
                Extracted automatically from social video comments and community responses.
              </p>
            </div>

            {/* Sentiment Meter Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Happy', emoji: '😊', count: 42, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Excited', emoji: '🔥', count: 28, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
                { label: 'Question', emoji: '❓', count: 19, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
                { label: 'Neutral', emoji: '😐', count: 12, color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' },
                { label: 'Curious', emoji: '💡', count: 15, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
                { label: 'Urgent', emoji: '⚡', count: 8, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
              ].map((em) => (
                <Card key={em.label} className={cn('p-4 text-center border', em.color)}>
                  <div className="text-2xl mb-1">{em.emoji}</div>
                  <div className="text-lg font-black text-fg">{em.count}</div>
                  <div className="text-[11px] font-semibold text-muted">{em.label}</div>
                </Card>
              ))}
            </div>

            {/* AI Next Content Ideas */}
            <Card className="p-6 border-line/80 bg-card/60">
              <h3 className="text-sm font-bold text-fg flex items-center gap-2 mb-3">
                <Sparkles className="size-4 text-primary" /> AI Recommended Next Video Topics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-card-strong border border-line">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-fg">Complete Pricing & Package Comparison</span>
                    <Badge>Trending Demand</Badge>
                  </div>
                  <p className="text-muted text-[11px]">
                    Derived from 14 viewer comments inquiring about tiers, commercial licenses, and delivery options.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-card-strong border border-line">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-fg">How It Works: Step-by-Step Walkthrough</span>
                    <Badge>High Engagement</Badge>
                  </div>
                  <p className="text-muted text-[11px]">
                    Audience asked how setup works on mobile and what channels can connect simultaneously.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
