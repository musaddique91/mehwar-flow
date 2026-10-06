'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  Laptop,
  Mail,
  MessageSquare,
  Phone,
  Play,
  Share2,
  Smartphone,
  Sparkles,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  PLATFORM_RULES,
  type CustomerDto,
  type Platform,
  type PostDto,
} from '@mehwar/shared';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';

export interface CustomerMessagePreviewModalProps {
  open: boolean;
  onClose: () => void;
  post: PostDto;
  customMessage: string;
  selectedCustomers: CustomerDto[];
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
  onProceedToShare?: () => void;
}

export function CustomerMessagePreviewModal({
  open,
  onClose,
  post,
  customMessage,
  selectedCustomers,
  sendEmail = true,
  sendWhatsApp = true,
  onProceedToShare,
}: CustomerMessagePreviewModalProps) {
  // Determine default tab based on active delivery channels
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email'>(
    sendWhatsApp ? 'whatsapp' : 'email',
  );
  const [emailDevice, setEmailDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    selectedCustomers[0]?.id || '',
  );
  const [copied, setCopied] = useState(false);

  // Active customer to preview
  const activeCustomer = useMemo(() => {
    if (selectedCustomers.length > 0) {
      const match = selectedCustomers.find((c) => c.id === selectedCustomerId);
      return match || selectedCustomers[0];
    }
    // Fallback sample customer if none selected yet
    return {
      id: 'sample-customer',
      name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      mobileNumber: '+971 50 123 4567',
      whatsappNumber: '+971 50 123 4567',
    } as CustomerDto;
  }, [selectedCustomers, selectedCustomerId]);

  const customerName = activeCustomer.name || 'Valued Customer';
  const customerEmail = activeCustomer.email || 'customer@example.com';
  const customerPhone = activeCustomer.whatsappNumber || activeCustomer.mobileNumber || '+971 50 123 4567';

  // Resolved published targets or realistic preview links
  const previewLinks = useMemo(() => {
    const published = post.targets.filter(
      (t) => (t.status === 'PUBLISHED' || t.status === 'QUEUED' || t.externalUrl) && t.externalUrl,
    );

    if (published.length > 0) {
      return published.map((t) => {
        const label = PLATFORM_RULES[t.platform]?.label ?? t.platform;
        return {
          id: t.id,
          platform: t.platform,
          label,
          url: t.externalUrl!,
          channelName: label,
        };
      });
    }

    // Fallback preview links from channels attached to the post
    if (post.targets.length > 0) {
      return post.targets.map((t) => {
        const platform = t.platform;
        const label = PLATFORM_RULES[platform]?.label ?? platform;
        const fallbackUrls: Record<string, string> = {
          youtube: 'https://youtube.com/watch?v=sample-video',
          instagram: 'https://instagram.com/p/sample-post',
          facebook: 'https://facebook.com/watch?v=sample-video',
          linkedin: 'https://linkedin.com/posts/sample-post',
          x: 'https://x.com/mehwar/status/sample-post',
          threads: 'https://threads.net/@mehwar/post/sample',
          tiktok: 'https://tiktok.com/@mehwar/video/sample',
        };
        return {
          id: t.id,
          platform,
          label,
          url: fallbackUrls[platform] || 'https://mehwar.io/post/sample',
          channelName: label,
        };
      });
    }

    // Ultimate fallback for demo
    return [
      {
        id: '1',
        platform: 'youtube' as Platform,
        label: 'YouTube',
        url: 'https://youtube.com/watch?v=sample-video',
        channelName: 'Mehwar Official Channel',
      },
      {
        id: '2',
        platform: 'instagram' as Platform,
        label: 'Instagram',
        url: 'https://instagram.com/p/sample-reel',
        channelName: '@mehwar_flow',
      },
    ];
  }, [post.targets]);

  const firstMedia = post.media[0];

  // Build raw WhatsApp message string matching backend format
  const whatsappRawText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`*🎬 New Video & Update from Mehwar Flow*`);
    if (customerName) parts.push(`Hi ${customerName}! 👋`);
    if (customMessage.trim()) {
      parts.push(`\n💬 *Note:*\n${customMessage.trim()}`);
    }
    if (post.text) {
      const excerpt = post.text.length > 300 ? post.text.slice(0, 297) + '...' : post.text;
      parts.push(`\n📝 *Description:*\n${excerpt.trim()}`);
    }
    if (previewLinks.length > 0) {
      parts.push(`\n🔗 *Watch Now:*`);
      for (const l of previewLinks) {
        parts.push(`▶️ *${l.label}*: ${l.url}`);
      }
    }
    parts.push(`\n_Sent via Mehwar Flow_`);
    return parts.join('\n');
  }, [customerName, customMessage, post.text, previewLinks]);

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappRawText);
      setCopied(true);
      toast.success('WhatsApp message copied to clipboard!');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Generate WhatsApp web direct link for testing
  const whatsappWebUrl = useMemo(() => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappRawText)}`;
  }, [customerPhone, whatsappRawText]);

  // Platform specific color palette for email CTA buttons
  const PLATFORM_COLORS: Record<string, { bg: string; text: string }> = {
    youtube: { bg: '#FF0000', text: '#FFFFFF' },
    linkedin: { bg: '#0A66C2', text: '#FFFFFF' },
    facebook: { bg: '#1877F2', text: '#FFFFFF' },
    instagram: { bg: '#E4405F', text: '#FFFFFF' },
    x: { bg: '#0F1419', text: '#FFFFFF' },
    threads: { bg: '#101010', text: '#FFFFFF' },
    tiktok: { bg: '#000000', text: '#00F2FE' },
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Message Preview"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Header Toolbar: Recipient Selector & Channel Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-3">
          {/* Recipient Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted shrink-0 flex items-center gap-1">
              <User className="size-3.5 text-primary" /> Previewing for:
            </span>

            {selectedCustomers.length > 1 ? (
              <div className="relative">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="appearance-none rounded-xl border border-line bg-elevated pl-3 pr-7 py-1 text-xs font-semibold text-fg outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer"
                >
                  {selectedCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email || c.mobileNumber})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted pointer-events-none" />
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-2.5 py-1 text-xs font-semibold text-fg">
                <span>{customerName}</span>
                {selectedCustomers.length === 0 && (
                  <span className="text-[10px] text-muted font-normal italic">(sample)</span>
                )}
              </span>
            )}
          </div>

          {/* Channel Tabs */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-elevated/80 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                activeTab === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted hover:text-fg hover:bg-line/50',
              )}
            >
              <MessageSquare className="size-3.5" />
              <span>WhatsApp</span>
              <span className="size-1.5 rounded-full bg-emerald-300" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                activeTab === 'email'
                  ? 'bg-fuchsia-600 text-white shadow-xs'
                  : 'text-muted hover:text-fg hover:bg-line/50',
              )}
            >
              <Mail className="size-3.5" />
              <span>Email</span>
              <span className="size-1.5 rounded-full bg-fuchsia-300" />
            </button>
          </div>
        </div>

        {/* Tab 1: WhatsApp Smartphone Preview */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted">
                <Smartphone className="size-3.5 text-emerald-500" />
                <span>Customer WhatsApp Chat View</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono px-2 py-0.5 rounded-full">
                  Target: {customerPhone}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-2.5 py-1 text-xs font-semibold text-fg hover:bg-line transition"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3 text-muted" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <a
                  href={whatsappWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition"
                >
                  <span>Test in WhatsApp Web</span>
                  <ExternalLink className="size-2.5" />
                </a>
              </div>
            </div>

            {/* Smartphone Mockup */}
            <div className="mx-auto max-w-[430px] rounded-[38px] border-4 border-slate-800 bg-slate-900 shadow-2xl p-2.5 overflow-hidden">
              {/* iPhone Notch / Dynamic Island */}
              <div className="relative mx-auto mb-2 h-4 w-28 rounded-full bg-black flex items-center justify-center">
                <span className="size-2 rounded-full bg-slate-800" />
              </div>

              {/* WhatsApp App Container */}
              <div className="rounded-[28px] overflow-hidden bg-[#e5ddd5] dark:bg-[#0b141a] flex flex-col min-h-[500px] border border-black/20">
                {/* WhatsApp Chat App Bar */}
                <div className="bg-[#075e54] dark:bg-[#202c33] text-white px-3.5 py-2.5 flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ArrowLeft className="size-4 shrink-0 opacity-80" />
                    <div className="relative size-8 shrink-0 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/30">
                      M
                      <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-400 border border-slate-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold truncate">Mehwar Flow</span>
                        <Check className="size-3 text-emerald-300 shrink-0" />
                      </div>
                      <span className="text-[10px] text-white/70 block truncate">
                        Verified Business Account · online
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-white/85">
                    <Video className="size-4 cursor-pointer hover:opacity-100" />
                    <Phone className="size-3.5 cursor-pointer hover:opacity-100" />
                  </div>
                </div>

                {/* WhatsApp Chat Body */}
                <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-[radial-gradient(#0000000a_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]">
                  {/* Today Divider */}
                  <div className="flex justify-center">
                    <span className="rounded-lg bg-white/80 dark:bg-[#182229]/90 px-3 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 shadow-xs uppercase tracking-wider">
                      Today
                    </span>
                  </div>

                  {/* Outgoing Message Bubble (Brand -> Customer) */}
                  <div className="flex justify-end">
                    <div className="relative max-w-[88%] rounded-2xl rounded-tr-xs bg-[#d9fdd3] dark:bg-[#005c4b] p-3 text-slate-800 dark:text-slate-100 shadow-md border border-emerald-600/10 dark:border-emerald-400/10 space-y-2">
                      {/* Media Card (if available) */}
                      {firstMedia && (
                        <div className="relative overflow-hidden rounded-xl bg-black/10 border border-black/10">
                          {firstMedia.thumbnailUrl || firstMedia.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={firstMedia.thumbnailUrl || firstMedia.url || ''}
                              alt=""
                              className="w-full max-h-48 object-cover rounded-xl"
                            />
                          ) : (
                            <div className="flex h-36 items-center justify-center bg-black/40 text-white">
                              <Play className="size-8" />
                            </div>
                          )}

                          {firstMedia.kind === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
                                <Play className="size-5 fill-slate-900 ml-0.5" />
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Header Title */}
                      <p className="font-bold text-xs text-emerald-950 dark:text-emerald-200">
                        🎬 New Video & Update from Mehwar Flow
                      </p>

                      {/* Greeting */}
                      <p className="text-xs text-slate-800 dark:text-slate-100">
                        Hi <span className="font-semibold">{customerName}</span>! 👋
                      </p>

                      {/* Custom Note Callout */}
                      {customMessage.trim() && (
                        <div className="rounded-lg bg-emerald-600/10 dark:bg-emerald-900/30 p-2 text-xs border-l-3 border-emerald-600 text-emerald-950 dark:text-emerald-100">
                          <span className="font-bold block text-[10px] text-emerald-700 dark:text-emerald-300">
                            💬 Note:
                          </span>
                          {customMessage.trim()}
                        </div>
                      )}

                      {/* Post Description Excerpt */}
                      {post.text && (
                        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                          <span className="font-bold text-[10px] block text-slate-500 dark:text-slate-400">
                            📝 Description:
                          </span>
                          {post.text.length > 280 ? post.text.slice(0, 277) + '...' : post.text}
                        </div>
                      )}

                      {/* Watch Links */}
                      {previewLinks.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-emerald-900/10 dark:border-emerald-100/10">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                            🔗 Watch Now:
                          </span>
                          {previewLinks.map((l) => (
                            <a
                              key={l.id}
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                            >
                              <PlatformIcon platform={l.platform} className="size-3 shrink-0" />
                              <span>{l.label}:</span>
                              <span className="text-[11px] font-normal underline truncate">
                                {l.url}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Footer Attribution & Timestamp */}
                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="italic">Sent via Mehwar Flow</span>
                        <div className="flex items-center gap-1">
                          <span>1:48 PM</span>
                          <CheckCheck className="size-3 text-[#53bdeb]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Input Bar Mockup */}
                <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 flex items-center gap-2 border-t border-black/10">
                  <div className="flex-1 rounded-full bg-white dark:bg-[#2a3942] px-3.5 py-1.5 text-xs text-muted">
                    Reply message...
                  </div>
                  <div className="size-8 rounded-full bg-[#00a884] text-white flex items-center justify-center">
                    <Share2 className="size-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: HTML Email Client Preview */}
        {activeTab === 'email' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted">
                <Mail className="size-3.5 text-fuchsia-500" />
                <span>Customer Email Inbox View</span>
                <span className="text-[10px] bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 font-mono px-2 py-0.5 rounded-full">
                  Target: {customerEmail}
                </span>
              </div>

              {/* Desktop vs Mobile Toggle */}
              <div className="flex items-center gap-1 rounded-xl border border-line bg-elevated p-1">
                <button
                  type="button"
                  onClick={() => setEmailDevice('desktop')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition',
                    emailDevice === 'desktop'
                      ? 'bg-line text-fg'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  <Laptop className="size-3" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmailDevice('mobile')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition',
                    emailDevice === 'mobile'
                      ? 'bg-line text-fg'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  <Smartphone className="size-3" />
                  <span>Mobile</span>
                </button>
              </div>
            </div>

            {/* Email Client Shell */}
            <div
              className={cn(
                'mx-auto rounded-3xl border border-line bg-slate-100 dark:bg-slate-950 p-3 sm:p-5 shadow-xl transition-all duration-300',
                emailDevice === 'mobile' ? 'max-w-[400px]' : 'max-w-[650px]',
              )}
            >
              {/* Mail Envelope Header */}
              <div className="rounded-2xl border border-line bg-white dark:bg-card-strong p-3.5 mb-4 shadow-xs space-y-1.5 text-xs text-fg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-fg">Mehwar Flow</span>
                    <span className="text-[11px] text-muted">&lt;updates@mehwar.io&gt;</span>
                  </div>
                  <span className="text-[10px] text-muted">Just now</span>
                </div>
                <div className="text-[11px] text-muted">
                  <span>To: </span>
                  <span className="text-fg font-semibold">{customerName}</span> &lt;{customerEmail}&gt;
                </div>
                <div className="text-xs font-bold text-fg pt-1 border-t border-line/60">
                  Subject:{' '}
                  <span className="font-medium text-muted">
                    {customMessage.trim()
                      ? `New update: ${customMessage.trim().slice(0, 45)}...`
                      : 'New Video & Social Update'}
                  </span>
                </div>
              </div>

              {/* Real HTML Email Rendered Canvas */}
              <div className="rounded-2xl overflow-hidden bg-white text-slate-800 shadow-xl border border-slate-200">
                {/* Top Gradient Bar */}
                <div className="h-2 w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-orange-400" />

                <div className="p-6 sm:p-8 space-y-5">
                  {/* Brand Header */}
                  <div>
                    <span className="text-base font-black tracking-tight bg-gradient-to-r from-purple-600 via-fuchsia-600 to-orange-500 bg-clip-text text-transparent">
                      Mehwar Flow
                    </span>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
                      New Video & Social Update
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Hi <strong>{customerName}</strong>, we just published a new video and wanted to share the direct links with you!
                    </p>
                  </div>

                  {/* Custom Personal Message Callout */}
                  {customMessage.trim() && (
                    <div className="rounded-xl border-l-4 border-fuchsia-500 bg-fuchsia-50 p-4 text-xs sm:text-sm text-fuchsia-950 font-medium leading-relaxed">
                      {customMessage.trim()}
                    </div>
                  )}

                  {/* Video Thumbnail */}
                  {firstMedia && (
                    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {firstMedia.thumbnailUrl || firstMedia.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstMedia.thumbnailUrl || firstMedia.url || ''}
                          alt="Video Preview"
                          className="w-full max-h-72 object-cover"
                        />
                      ) : (
                        <div className="flex h-44 items-center justify-center bg-slate-800 text-white">
                          <Play className="size-10" />
                        </div>
                      )}
                      {firstMedia.kind === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <span className="flex size-14 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-xl">
                            <Play className="size-6 fill-slate-900 ml-0.5" />
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post Text Description */}
                  {post.text && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {post.text}
                    </div>
                  )}

                  {/* Platform CTA Buttons */}
                  <div className="space-y-2.5 pt-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Watch on Your Favorite Platform:
                    </p>

                    <div className="space-y-2">
                      {previewLinks.map((l) => {
                        const style = PLATFORM_COLORS[l.platform.toLowerCase()] || {
                          bg: '#8B5CF6',
                          text: '#FFFFFF',
                        };
                        return (
                          <div
                            key={l.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 hover:bg-slate-50 transition"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase">
                                <PlatformIcon platform={l.platform} className="size-3" />
                                <span>{l.label}</span>
                              </div>
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {l.channelName}
                              </p>
                            </div>

                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ backgroundColor: style.bg, color: style.text }}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold shadow-xs hover:opacity-90 transition shrink-0"
                            >
                              <span>Watch on {l.label}</span>
                              <span>&rarr;</span>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-200 pt-5 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-medium text-slate-500">
                      Sent directly to you via Mehwar Flow
                    </p>
                    <p className="text-[11px]">
                      If you have questions or wish to update your preferences, feel free to reply to this email.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-line/60">
          <Button variant="ghost" onClick={onClose}>
            Back to Edit
          </Button>

          {onProceedToShare && (
            <Button onClick={onProceedToShare} className="gap-2">
              <Share2 className="size-4" /> Looks Good, Send to Recipients
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
