'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  Mail,
  MessageSquare,
  Play,
  Search,
  Send,
  Share2,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  PLATFORM_RULES,
  type CustomerDto,
  type CustomerGroupDto,
  type Platform,
  type PostDto,
  type SharePostResultDto,
} from '@mehwar/shared';
import { Avatar, Button, Modal, Switch } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';
import { CustomerMessagePreviewModal } from './CustomerMessagePreviewModal';

export function ShareToCustomersModal({
  post,
  open,
  onClose,
}: {
  post: PostDto;
  open: boolean;
  onClose: () => void;
}) {
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [previewTab, setPreviewTab] = useState<'email' | 'whatsapp'>('email');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<SharePostResultDto | null>(null);

  const { data: customers } = useApi<CustomerDto[]>('/customers', ['customers']);
  const { data: groups } = useApi<CustomerGroupDto[]>('/customers/groups', ['customer-groups']);

  // Extract published targets with external URLs
  const publishedTargets = useMemo(() => {
    return post.targets.filter(
      (t) => (t.status === 'PUBLISHED' || t.status === 'QUEUED' || t.externalUrl) && t.externalUrl,
    );
  }, [post.targets]);

  // Compute resolved recipient count
  const resolvedRecipients = useMemo(() => {
    const map = new Map<string, CustomerDto>();
    if (!customers) return [];

    // Direct customers
    for (const cid of selectedCustomerIds) {
      const c = customers.find((x) => x.id === cid);
      if (c) map.set(c.id, c);
    }

    // From groups
    if (groups) {
      for (const gid of selectedGroupIds) {
        const g = groups.find((x) => x.id === gid);
        if (g?.members) {
          for (const m of g.members) {
            const c = customers.find((x) => x.id === m.customerId);
            if (c) map.set(c.id, c);
          }
        }
      }
    }

    return Array.from(map.values());
  }, [customers, groups, selectedCustomerIds, selectedGroupIds]);

  const emailEligibleCount = resolvedRecipients.filter((c) => Boolean(c.email)).length;
  const whatsappEligibleCount = resolvedRecipients.filter(
    (c) => Boolean(c.whatsappNumber || c.mobileNumber),
  ).length;

  // Search filtered options
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const custs = (customers || []).filter(
      (c) =>
        !selectedCustomerIds.has(c.id) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.mobileNumber.includes(q)),
    );

    const grps = (groups || []).filter(
      (g) => !selectedGroupIds.has(g.id) && (!q || g.name.toLowerCase().includes(q)),
    );

    return { customers: custs, groups: grps };
  }, [customers, groups, search, selectedCustomerIds, selectedGroupIds]);

  const addCustomer = (id: string) => {
    setSelectedCustomerIds((prev) => new Set([...prev, id]));
    setSearch('');
  };

  const removeCustomer = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const addGroup = (id: string) => {
    setSelectedGroupIds((prev) => new Set([...prev, id]));
    setSearch('');
  };

  const removeGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectAllCustomers = () => {
    if (customers) {
      setSelectedCustomerIds(new Set(customers.map((c) => c.id)));
    }
  };

  const clearAll = () => {
    setSelectedCustomerIds(new Set());
    setSelectedGroupIds(new Set());
  };

  const handleShare = async () => {
    if (resolvedRecipients.length === 0) {
      toast.error('Please select at least one customer or group.');
      return;
    }

    const channels: ('EMAIL' | 'WHATSAPP')[] = [];
    if (sendEmail) channels.push('EMAIL');
    if (sendWhatsApp) channels.push('WHATSAPP');

    if (channels.length === 0) {
      toast.error('Please select at least one delivery channel (Email or WhatsApp).');
      return;
    }

    setBusy(true);
    setLastResult(null);

    try {
      const res = await api<SharePostResultDto>('/customers/share-post', {
        method: 'POST',
        json: {
          postId: post.id,
          customerIds: Array.from(selectedCustomerIds),
          groupIds: Array.from(selectedGroupIds),
          channels,
          customMessage: customMessage.trim() || null,
        },
      });

      setLastResult(res);
      toast.success(res.message);
      if (!res.whatsappFallbackLinks || res.whatsappFallbackLinks.length === 0) {
        onClose();
      }
    } catch (err) {
      toast.error('Sharing failed', {
        description: (err as ApiError).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const firstMedia = post.media[0];

  return (
    <Modal open={open} onClose={onClose} title="Share to Customers" maxWidth="max-w-2xl">
      <div className="space-y-5">
        {/* Post Overview Banner */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-card/60 p-3.5">
          {firstMedia ? (
            <div className="relative size-14 shrink-0 rounded-xl overflow-hidden bg-line/80 border border-line">
              {firstMedia.thumbnailUrl || firstMedia.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={firstMedia.thumbnailUrl || firstMedia.url || ''}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted">
                  <Play className="size-5" />
                </div>
              )}
              {firstMedia.kind === 'video' && (
                <span className="absolute bottom-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/70 text-white">
                  <Play className="size-2 fill-white" />
                </span>
              )}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-xs text-fg line-clamp-1">
              {post.text || 'Social Post & Media'}
            </h4>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider">
                Published links:
              </span>
              {publishedTargets.map((t) => (
                <a
                  key={t.id}
                  href={t.externalUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-elevated/70 px-2 py-0.5 text-[10px] font-semibold text-fg hover:border-line/80"
                >
                  <PlatformIcon platform={t.platform} className="size-2.5" />
                  <span>{PLATFORM_RULES[t.platform]?.label ?? t.platform}</span>
                  <ExternalLink className="size-2 text-muted" />
                </a>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-elevated/90 px-3 py-1.5 text-xs font-semibold text-fg hover:bg-line transition shadow-xs shrink-0 self-center"
            title="Preview how message looks to customers"
          >
            <Eye className="size-3.5 text-primary" />
            <span>Preview</span>
          </button>
        </div>

        {/* Recipient Picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Select Customers & Groups ({resolvedRecipients.length} total recipients)
            </label>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={selectAllCustomers}
                className="text-primary hover:underline font-semibold"
              >
                All Customers
              </button>
              <span className="text-muted">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-muted hover:text-fg font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Interactive Chips Container */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-elevated/60 p-2 min-h-12 focus-within:ring-4 focus-within:ring-[var(--ring)]">
            {/* Selected Group Chips */}
            {Array.from(selectedGroupIds).map((gid) => {
              const g = groups?.find((x) => x.id === gid);
              if (!g) return null;
              return (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary"
                >
                  <Users className="size-3" />
                  <span>{g.name}</span>
                  <span className="text-[10px] opacity-75">({g.memberCount})</span>
                  <button
                    type="button"
                    onClick={() => removeGroup(g.id)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}

            {/* Selected Customer Chips */}
            {Array.from(selectedCustomerIds).map((cid) => {
              const c = customers?.find((x) => x.id === cid);
              if (!c) return null;
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-card-strong border border-line px-2.5 py-1 text-xs font-semibold text-fg shadow-sm"
                >
                  <User className="size-3 text-fuchsia-500" />
                  <span>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomer(c.id)}
                    className="hover:bg-line rounded-full p-0.5 text-muted hover:text-fg"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}

            <div className="flex-1 min-w-36 flex items-center gap-1.5 px-1">
              <Search className="size-3.5 text-muted shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  selectedCustomerIds.size === 0 && selectedGroupIds.size === 0
                    ? 'Type to search customers or groups…'
                    : 'Add more…'
                }
                className="w-full bg-transparent text-xs text-fg placeholder:text-muted outline-none"
              />
            </div>
          </div>

          {/* Search Dropdown Results */}
          {search.trim() && (
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-line bg-card-strong p-1.5 shadow-xl space-y-1">
              {filteredOptions.groups.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-2.5 py-1 block">
                    Groups
                  </span>
                  {filteredOptions.groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => addGroup(g.id)}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs hover:bg-line text-left transition"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="size-3.5 text-primary" />
                        <span className="font-semibold text-fg">{g.name}</span>
                      </div>
                      <span className="text-[10px] text-muted">
                        {g.memberCount} customer{g.memberCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {filteredOptions.customers.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-2.5 py-1 block">
                    Customers
                  </span>
                  {filteredOptions.customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addCustomer(c.id)}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs hover:bg-line text-left transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="size-3.5 text-fuchsia-500 shrink-0" />
                        <span className="font-semibold text-fg truncate">{c.name}</span>
                        <span className="text-[10px] text-muted truncate">
                          {c.email || c.mobileNumber}
                        </span>
                      </div>
                      <span className="text-[10px] text-primary font-medium shrink-0">+ Add</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredOptions.groups.length === 0 && filteredOptions.customers.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted">
                  No matching customers or groups
                </p>
              )}
            </div>
          )}
        </div>

        {/* Delivery Channels Selection */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Email Option */}
          <div
            onClick={() => setSendEmail((v) => !v)}
            className={cn(
              'flex items-center justify-between rounded-2xl border p-3.5 cursor-pointer transition',
              sendEmail
                ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                : 'border-line bg-card/40 opacity-70',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-500">
                <Mail className="size-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-fg">Send Email</p>
                <p className="text-[10px] text-muted">
                  {emailEligibleCount} of {resolvedRecipients.length} have email
                </p>
                <p className="text-[10px] text-muted/80 mt-0.5">
                  Inbox: <span className="text-fuchsia-400 font-mono">Mailpit (:8025)</span>
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={() => {}}
              className="size-4 accent-fuchsia-500 rounded pointer-events-none"
            />
          </div>

          {/* WhatsApp Option */}
          <div
            onClick={() => setSendWhatsApp((v) => !v)}
            className={cn(
              'flex items-center justify-between rounded-2xl border p-3.5 cursor-pointer transition',
              sendWhatsApp
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-line bg-card/40 opacity-70',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <MessageSquare className="size-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-fg">Send WhatsApp</p>
                <p className="text-[10px] text-muted">
                  {whatsappEligibleCount} of {resolvedRecipients.length} have WhatsApp
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={() => {}}
              className="size-4 accent-emerald-500 rounded pointer-events-none"
            />
          </div>
        </div>

        {/* Custom Intro Note */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Personal Message / Note (optional)
            </span>
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <Eye className="size-3" /> Preview formatted message
            </button>
          </div>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={2}
            placeholder="e.g. Check out our brand new video, let us know your thoughts!"
            className="w-full rounded-2xl border border-line bg-elevated/60 px-3.5 py-2.5 text-xs text-fg outline-none focus:ring-4 focus:ring-[var(--ring)] resize-none"
          />
        </div>

        {/* Live Preview Tabs */}
        <div className="space-y-2 rounded-2xl border border-line bg-elevated/40 p-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Eye className="size-3.5" /> Content Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-elevated px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-line transition shadow-xs"
              >
                <span>Full Phone & Email View &rarr;</span>
              </button>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPreviewTab('email')}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[10px] font-semibold transition',
                  previewTab === 'email' ? 'bg-line text-fg font-bold' : 'text-muted hover:text-fg',
                )}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('whatsapp')}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[10px] font-semibold transition',
                  previewTab === 'whatsapp'
                    ? 'bg-line text-fg font-bold'
                    : 'text-muted hover:text-fg',
                )}
              >
                WhatsApp
              </button>
            </div>
          </div>

          {previewTab === 'email' ? (
            <div className="space-y-2 p-2 text-xs bg-white text-slate-800 rounded-xl shadow-inner border border-line/60">
              <div className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-orange-400" />
              <p className="font-bold text-[13px] text-slate-900">New Video & Social Update</p>
              <p className="text-[11px] text-slate-500">
                Hi <b>Customer</b>, we just published a new video and wanted to share the direct links with you!
              </p>
              {customMessage && (
                <div className="bg-fuchsia-50 border-l-2 border-fuchsia-400 p-2 text-[11px] text-fuchsia-900 rounded">
                  {customMessage}
                </div>
              )}
              <div className="space-y-1.5 pt-1">
                {publishedTargets.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 p-2 text-[11px]"
                  >
                    <span className="font-bold text-slate-700">
                      {PLATFORM_RULES[t.platform]?.label ?? t.platform}
                    </span>
                    <span className="text-[10px] bg-slate-900 text-white font-semibold px-2 py-1 rounded">
                      Watch on {PLATFORM_RULES[t.platform]?.label ?? t.platform} &rarr;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-3 text-xs text-fg space-y-1 font-mono text-[11px]">
              <p className="font-bold text-emerald-400">🎬 *New Video & Update from Mehwar Flow*</p>
              {customMessage && <p className="text-muted">💬 *Note:* {customMessage}</p>}
              <p className="text-muted">📝 *Description:* {post.text.slice(0, 100)}...</p>
              <p className="font-semibold text-emerald-300 pt-1">🔗 *Watch Now:*</p>
              {publishedTargets.map((t) => (
                <p key={t.id} className="text-[10px] text-muted">
                  ▶️ *{PLATFORM_RULES[t.platform]?.label ?? t.platform}*: {t.externalUrl}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Email Sent to Mailpit Banner */}
        {lastResult && lastResult.emailsSent > 0 && (
          <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Mail className="size-4 text-fuchsia-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-fg">
                  {lastResult.emailsSent} email{lastResult.emailsSent !== 1 ? 's' : ''} delivered to Mailpit!
                </p>
                <p className="text-[11px] text-muted">
                  Open your local Mailpit web inbox to inspect the rendered HTML email and video links.
                </p>
              </div>
            </div>
            <a
              href="http://localhost:8025"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/20 px-3 py-1.5 text-xs font-semibold text-fuchsia-300 hover:bg-fuchsia-500/30 transition shrink-0"
            >
              <span>View in Mailpit</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {/* Fallback Direct Links (if any) */}
        {lastResult?.whatsappFallbackLinks && lastResult.whatsappFallbackLinks.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
            <p className="text-xs font-bold text-amber-500">
              ⚡ One-Click WhatsApp Web Direct Send ({lastResult.whatsappFallbackLinks.length} recipients):
            </p>
            <p className="text-[11px] text-muted">
              Click each button below to open WhatsApp Web and send directly to your customer:
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
              {lastResult.whatsappFallbackLinks.map((fb) => (
                <a
                  key={fb.customerId}
                  href={fb.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card-strong px-2.5 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 transition"
                >
                  <MessageSquare className="size-3" />
                  <span>Send to {fb.customerName}</span>
                  <ExternalLink className="size-2.5" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-line/60">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {lastResult ? 'Done' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPreviewModalOpen(true)}
              className="gap-2"
            >
              <Eye className="size-4 text-primary" /> Preview Message
            </Button>
          </div>

          <Button
            onClick={handleShare}
            loading={busy}
            disabled={resolvedRecipients.length === 0 || (!sendEmail && !sendWhatsApp)}
            className="gap-2"
          >
            <Send className="size-4" /> Share with {resolvedRecipients.length} Recipient
            {resolvedRecipients.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      {/* Dedicated Full Customer Message Preview Modal */}
      <CustomerMessagePreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        post={post}
        customMessage={customMessage}
        selectedCustomers={resolvedRecipients}
        sendEmail={sendEmail}
        sendWhatsApp={sendWhatsApp}
        onProceedToShare={() => {
          setPreviewModalOpen(false);
          handleShare();
        }}
      />
    </Modal>
  );
}
