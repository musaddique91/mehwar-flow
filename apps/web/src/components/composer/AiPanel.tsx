'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  Flame,
  Hash,
  Lightbulb,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Wand2,
  WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_RULES, type Platform } from '@mehwar/shared';
import { Button, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { PlatformIcon } from '@/lib/platforms';

interface Caption {
  platform: Platform;
  text: string;
  hashtags: string[];
}

interface HookItem {
  id: string;
  style: string;
  text: string;
  whyItWorks: string;
}

interface PostIdeaItem {
  id: string;
  title: string;
  hook: string;
  angle: string;
  body: string;
  callToAction: string;
  suggestedPlatform: string;
  hashtags: string[];
}

const TONES = ['Friendly', 'Professional', 'Playful', 'Bold', 'Inspiring', 'Viral / Punchy'];
type AiMode = 'captions' | 'hashtags' | 'hooks' | 'ideas' | 'rewrite';

export function AiPanel({
  open,
  onClose,
  platforms,
  currentText,
  onUseMain,
  onUseFor,
}: {
  open: boolean;
  onClose: () => void;
  platforms: Platform[];
  currentText: string;
  onUseMain: (text: string) => void;
  onUseFor: (platform: Platform, text: string) => void;
}) {
  const { data: aiSettings } = useApi<{
    aiProvider: string | null;
    aiBaseUrl: string | null;
    aiModel: string | null;
    aiDefaultModel: string | null;
  }>(open ? '/ai/settings' : null, ['ai']);

  const [activeTab, setActiveTab] = useState<AiMode>('captions');
  const [tone, setTone] = useState('Friendly');
  const [busy, setBusy] = useState(false);

  // Captions state
  const [captionPrompt, setCaptionPrompt] = useState('');
  const [captions, setCaptions] = useState<Caption[]>([]);

  // Hashtags state
  const [hashtagInput, setHashtagInput] = useState(currentText);
  const [hashtagCount, setHashtagCount] = useState(15);
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);

  // Hooks state
  const [hookInput, setHookInput] = useState(currentText);
  const [generatedHooks, setGeneratedHooks] = useState<HookItem[]>([]);

  // Ideas state
  const [ideaTopic, setIdeaTopic] = useState('');
  const [generatedIdeas, setGeneratedIdeas] = useState<PostIdeaItem[]>([]);

  // Rewrite state
  const [rewriteInput, setRewriteInput] = useState(currentText);
  const [rewriteInstruction, setRewriteInstruction] = useState('');

  const targets = platforms.length ? platforms : (['instagram', 'x'] as Platform[]);

  // Sync currentText to sub-inputs when opened
  useEffect(() => {
    if (open && currentText) {
      if (!hashtagInput) setHashtagInput(currentText);
      if (!hookInput) setHookInput(currentText);
      if (!rewriteInput) setRewriteInput(currentText);
    }
  }, [open, currentText]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runCaptions() {
    setBusy(true);
    try {
      const res = await api<Caption[]>('/ai/caption', {
        method: 'POST',
        json: { prompt: captionPrompt, platforms: targets, tone },
      });
      setCaptions(res);
      toast.success(`Generated ${res.length} platform captions! ✨`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Caption generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function runHashtags() {
    const textToUse = hashtagInput.trim() || currentText.trim();
    if (!textToUse) {
      toast.error('Please enter content or a topic to generate hashtags for');
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ hashtags: string[]; rawText: string; modelUsed: string }>(
        '/ai/hashtags',
        {
          method: 'POST',
          json: {
            text: textToUse,
            platform: targets[0] ?? 'instagram',
            count: hashtagCount,
          },
        },
      );
      setGeneratedHashtags(res.hashtags);
      toast.success(`Generated ${res.hashtags.length} hashtags!`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Hashtags generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function runHooks() {
    const textToUse = hookInput.trim() || currentText.trim();
    if (!textToUse) {
      toast.error('Please enter a draft or topic to generate hooks for');
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ hooks: HookItem[]; modelUsed: string }>('/ai/hooks', {
        method: 'POST',
        json: { text: textToUse, count: 5 },
      });
      setGeneratedHooks(res.hooks);
      toast.success(`Generated ${res.hooks.length} viral hooks! ⚡`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Hook generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function runIdeas() {
    if (!ideaTopic.trim()) {
      toast.error('Please enter a topic or niche to brainstorm');
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ ideas: PostIdeaItem[]; modelUsed: string }>('/ai/ideas', {
        method: 'POST',
        json: {
          topic: ideaTopic.trim(),
          platform: targets[0] ?? 'Multi-platform',
          count: 4,
        },
      });
      setGeneratedIdeas(res.ideas);
      toast.success(`Generated ${res.ideas.length} viral post angles! 💡`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Brainstorming failed');
    } finally {
      setBusy(false);
    }
  }

  async function runRewrite() {
    const textToUse = rewriteInput.trim() || currentText.trim();
    if (!textToUse) {
      toast.error('Please enter text to rewrite');
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.all(
        targets.map(async (platform) => {
          const r = await api<{ text: string }>('/ai/rewrite', {
            method: 'POST',
            json: {
              text: textToUse,
              platform,
              instruction: `Tone: ${tone}${rewriteInstruction ? `. ${rewriteInstruction}` : ''}`,
            },
          });
          return { platform, text: r.text, hashtags: [] };
        }),
      );
      setCaptions(results);
      toast.success('Rewritten for selected platforms!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Rewrite failed');
    } finally {
      setBusy(false);
    }
  }

  const fullCaption = (c: Caption) =>
    c.hashtags.length ? `${c.text}\n\n${c.hashtags.map((h) => `#${h}`).join(' ')}` : c.text;

  function appendHashtagsToPost(tags: string[]) {
    const block = tags.join(' ');
    const newText = currentText.trim() ? `${currentText.trim()}\n\n${block}` : block;
    onUseMain(newText);
    toast.success('Appended hashtags to composer!');
    onClose();
  }

  function prependHookToPost(hookText: string) {
    const newText = currentText.trim() ? `${hookText}\n\n${currentText.trim()}` : hookText;
    onUseMain(newText);
    toast.success('Applied hook as opening line!');
    onClose();
  }

  function applyIdeaToPost(idea: PostIdeaItem) {
    const tags = idea.hashtags.length ? `\n\n${idea.hashtags.map((h) => `#${h}`).join(' ')}` : '';
    const formatted = `${idea.hook}\n\n${idea.body}\n\n${idea.callToAction}${tags}`.trim();
    onUseMain(formatted);
    toast.success(`Loaded concept "${idea.title}" into composer!`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="AI Studio & Content Assistant" maxWidth="max-w-2xl">
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        {/* Navigation Tabs */}
        <div className="no-scrollbar flex gap-1.5 border-b border-line pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('captions')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'captions'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted hover:bg-elevated hover:text-fg'
            }`}
          >
            <Wand2 className="size-3.5" />
            <span>Captions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hashtags')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'hashtags'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted hover:bg-elevated hover:text-fg'
            }`}
          >
            <Hash className="size-3.5" />
            <span>Hashtags</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hooks')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'hooks'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted hover:bg-elevated hover:text-fg'
            }`}
          >
            <Flame className="size-3.5" />
            <span>Viral Hooks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ideas')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'ideas'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted hover:bg-elevated hover:text-fg'
            }`}
          >
            <Lightbulb className="size-3.5" />
            <span>Post Ideas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rewrite')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'rewrite'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted hover:bg-elevated hover:text-fg'
            }`}
          >
            <WandSparkles className="size-3.5" />
            <span>Polish & Rewrite</span>
          </button>
        </div>

        {/* 1. CAPTIONS TAB */}
        {activeTab === 'captions' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">What is your post about?</label>
              <textarea
                value={captionPrompt}
                onChange={(e) => setCaptionPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. 5 productivity habits that transformed my workflow this month, or our flash sale launch"
                className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted">Select Tone of Voice</span>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-xl border px-3 py-1 text-xs font-semibold transition ${
                      tone === t
                        ? 'border-transparent bg-fg text-[var(--bg)] shadow-sm'
                        : 'border-line text-muted hover:text-fg hover:border-line/80'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Button
              size="sm"
              onClick={runCaptions}
              loading={busy}
              disabled={!captionPrompt.trim()}
              className="gap-2"
            >
              <Sparkles className="size-3.5" /> Write Multi-Platform Captions
            </Button>

            {/* Generated Captions */}
            <AnimatePresence>
              {captions.map((c, i) => (
                <motion.div
                  key={c.platform + i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                  exit={{ opacity: 0 }}
                  className="space-y-3 rounded-2xl border border-line bg-elevated/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-fg">
                      <PlatformIcon platform={c.platform} className="size-4" />{' '}
                      {PLATFORM_RULES[c.platform].label}
                    </div>
                    <span className="text-[11px] text-muted">{fullCaption(c).length} chars</span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg/90">
                    {fullCaption(c)}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-line/60">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onUseFor(c.platform, fullCaption(c))}
                      className="gap-1.5 text-xs"
                    >
                      <Check className="size-3" /> Use for {PLATFORM_RULES[c.platform].label}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onUseMain(fullCaption(c))}
                      className="text-xs"
                    >
                      Use as main text
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(fullCaption(c));
                        toast.success('Copied to clipboard');
                      }}
                      className="text-xs"
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* 2. HASHTAGS TAB */}
        {activeTab === 'hashtags' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">Post Draft or Topic</label>
              <textarea
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                rows={3}
                placeholder="Paste your post or enter keywords to generate matching hashtags..."
                className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">Quantity:</span>
                {[10, 15, 25, 30].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setHashtagCount(count)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      hashtagCount === count
                        ? 'bg-fg text-[var(--bg)]'
                        : 'border border-line text-muted hover:text-fg'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                onClick={runHashtags}
                loading={busy}
                disabled={!hashtagInput.trim() && !currentText.trim()}
                className="gap-2"
              >
                <Hash className="size-3.5" /> Generate Hashtags
              </Button>
            </div>

            {/* Generated Hashtags Pills */}
            {generatedHashtags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 rounded-2xl border border-line bg-elevated/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-fg">
                    {generatedHashtags.length} Strategic Hashtags Generated
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs gap-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedHashtags.join(' '));
                        toast.success('Hashtags copied to clipboard');
                      }}
                    >
                      <Copy className="size-3" /> Copy All
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs gap-1.5"
                      onClick={() => appendHashtagsToPost(generatedHashtags)}
                    >
                      <Plus className="size-3" /> Append to Post
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {generatedHashtags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-line/60 px-3 py-1 text-xs font-mono font-medium text-primary border border-line hover:bg-line transition cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(tag);
                        toast.success(`Copied ${tag}`);
                      }}
                      title="Click to copy"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* 3. VIRAL HOOKS TAB */}
        {activeTab === 'hooks' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">Post Concept or Draft</label>
              <textarea
                value={hookInput}
                onChange={(e) => setHookInput(e.target.value)}
                rows={3}
                placeholder="Enter what your post is explaining or offering, to generate scroll-stopping first lines..."
                className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]"
              />
            </div>

            <Button
              size="sm"
              onClick={runHooks}
              loading={busy}
              disabled={!hookInput.trim() && !currentText.trim()}
              className="gap-2"
            >
              <Flame className="size-3.5" /> Generate 5 Magnetic Hooks
            </Button>

            {/* Generated Hooks Cards */}
            <div className="space-y-2.5">
              {generatedHooks.map((h, i) => (
                <motion.div
                  key={h.id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                  className="rounded-2xl border border-line bg-elevated/40 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      {h.style}
                    </span>
                    <span className="text-[11px] text-muted italic">{h.whyItWorks}</span>
                  </div>

                  <p className="text-sm font-medium text-fg leading-relaxed">
                    &ldquo;{h.text}&rdquo;
                  </p>

                  <div className="flex items-center gap-2 pt-1 border-t border-line/50">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs gap-1.5"
                      onClick={() => prependHookToPost(h.text)}
                    >
                      <Plus className="size-3" /> Use as Opener
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        onUseMain(h.text);
                        toast.success('Hook set as post text');
                        onClose();
                      }}
                    >
                      Replace Text
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(h.text);
                        toast.success('Hook copied');
                      }}
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 4. POST IDEAS TAB */}
        {activeTab === 'ideas' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">Topic, Keyword, or Niche</label>
              <textarea
                value={ideaTopic}
                onChange={(e) => setIdeaTopic(e.target.value)}
                rows={2}
                placeholder="e.g. AI tools for creator workflows, remote team building, fitness over 40"
                className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]"
              />
            </div>

            <Button
              size="sm"
              onClick={runIdeas}
              loading={busy}
              disabled={!ideaTopic.trim()}
              className="gap-2"
            >
              <Lightbulb className="size-3.5" /> Brainstorm Content Angles
            </Button>

            {/* Generated Ideas Cards */}
            <div className="space-y-3">
              {generatedIdeas.map((idea, idx) => (
                <motion.div
                  key={idea.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                  className="rounded-2xl border border-line bg-elevated/40 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-fg">{idea.title}</h4>
                    <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-0.5 text-[10px] font-bold text-fuchsia-400">
                      {idea.angle}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-muted leading-relaxed">
                    <p>
                      <strong className="text-fg font-semibold">Hook:</strong> &ldquo;{idea.hook}&rdquo;
                    </p>
                    <p className="whitespace-pre-wrap">
                      <strong className="text-fg font-semibold">Outline:</strong> {idea.body}
                    </p>
                    {idea.callToAction && (
                      <p>
                        <strong className="text-fg font-semibold">CTA:</strong> {idea.callToAction}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line/60">
                    <span className="text-[11px] text-muted">
                      Best on: <strong className="text-fg">{idea.suggestedPlatform}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      className="text-xs gap-1.5"
                      onClick={() => applyIdeaToPost(idea)}
                    >
                      <Sparkles className="size-3" /> Draft Post with this Concept
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 5. REWRITE TAB */}
        {activeTab === 'rewrite' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">Text to Polish & Rewrite</label>
              <textarea
                value={rewriteInput}
                onChange={(e) => setRewriteInput(e.target.value)}
                rows={3}
                placeholder="Paste the draft you want polished..."
                className="w-full rounded-2xl border border-line bg-elevated/60 px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted">Desired Tone</span>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-xl border px-3 py-1 text-xs font-semibold transition ${
                      tone === t
                        ? 'border-transparent bg-fg text-[var(--bg)] shadow-sm'
                        : 'border-line text-muted hover:text-fg'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">
                Custom Instruction (Optional)
              </label>
              <input
                type="text"
                value={rewriteInstruction}
                onChange={(e) => setRewriteInstruction(e.target.value)}
                placeholder="e.g. Add 3 bullet points, make the CTA stronger, or shorten by 50%"
                className="w-full rounded-xl border border-line bg-elevated/60 px-3.5 py-2 text-xs outline-none focus:ring-4 focus:ring-[var(--ring)]"
              />
            </div>

            <Button
              size="sm"
              onClick={runRewrite}
              loading={busy}
              disabled={!rewriteInput.trim() && !currentText.trim()}
              className="gap-2"
            >
              <WandSparkles className="size-3.5" /> Rewrite for Channels
            </Button>

            {/* Rewritten results */}
            <AnimatePresence>
              {captions.map((c, i) => (
                <motion.div
                  key={c.platform + i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                  exit={{ opacity: 0 }}
                  className="space-y-3 rounded-2xl border border-line bg-elevated/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-fg">
                      <PlatformIcon platform={c.platform} className="size-4" />{' '}
                      {PLATFORM_RULES[c.platform].label}
                    </div>
                    <span className="text-[11px] text-muted">{c.text.length} chars</span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg/90">
                    {c.text}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-line/60">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onUseFor(c.platform, c.text)}
                      className="gap-1.5 text-xs"
                    >
                      <Check className="size-3" /> Use for {PLATFORM_RULES[c.platform].label}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onUseMain(c.text)}
                      className="text-xs"
                    >
                      Use as main text
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(c.text);
                        toast.success('Copied');
                      }}
                      className="text-xs"
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer: Active Model Badge & Settings Shortcut */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary shrink-0" />
            <span>
              Powered by:{' '}
              <strong className="text-fg font-semibold">
                {aiSettings?.aiDefaultModel || aiSettings?.aiModel || 'Configured Model'}
              </strong>{' '}
              ({aiSettings?.aiProvider || 'openai'})
            </span>
          </div>

          <Link
            href="/settings?tab=ai"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Settings className="size-3.5" />
            <span>AI Settings & Key</span>
          </Link>
        </div>
      </div>
    </Modal>
  );
}
