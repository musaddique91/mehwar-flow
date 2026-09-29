'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Sparkles, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_RULES, type Platform } from '@mehwar/shared';
import { Button, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { PlatformIcon } from '@/lib/platforms';

interface Caption {
  platform: Platform;
  text: string;
  hashtags: string[];
}

const TONES = ['Friendly', 'Professional', 'Playful', 'Bold', 'Inspiring'];

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
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('Friendly');
  const [busy, setBusy] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const targets = platforms.length ? platforms : (['instagram', 'x'] as Platform[]);

  async function run(kind: 'caption' | 'rewrite') {
    setBusy(true);
    try {
      if (kind === 'caption') {
        setCaptions(
          await api<Caption[]>('/ai/caption', {
            method: 'POST',
            json: { prompt, platforms: targets, tone },
          }),
        );
      } else {
        const results = await Promise.all(
          targets.map(async (platform) => {
            const r = await api<{ text: string }>('/ai/rewrite', {
              method: 'POST',
              json: { text: currentText, platform, instruction: `Tone: ${tone}` },
            });
            return { platform, text: r.text, hashtags: [] };
          }),
        );
        setCaptions(results);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'The AI assistant failed');
    } finally {
      setBusy(false);
    }
  }

  const full = (c: Caption) =>
    c.hashtags.length ? `${c.text}\n\n${c.hashtags.map((h) => `#${h}`).join(' ')}` : c.text;

  return (
    <Modal open={open} onClose={onClose} title="Write with AI">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="What is the post about? e.g. “Our summer sale starts Friday, 20% off everything”"
          className="w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]"
        />
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone === t ? 'border-transparent bg-fg text-[var(--bg)]' : 'border-line text-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run('caption')} loading={busy} disabled={!prompt.trim()}>
            <Sparkles className="size-4" /> Write captions
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => run('rewrite')}
            loading={busy}
            disabled={!currentText.trim()}
          >
            <WandSparkles className="size-4" /> Rewrite my text per network
          </Button>
        </div>
        <AnimatePresence>
          {captions.map((c, i) => (
            <motion.div
              key={c.platform + i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
              exit={{ opacity: 0 }}
              className="space-y-2 rounded-2xl border border-line p-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <PlatformIcon platform={c.platform} className="size-4" />{' '}
                {PLATFORM_RULES[c.platform].label}
              </div>
              <p className="whitespace-pre-wrap text-sm">{full(c)}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => onUseFor(c.platform, full(c))}>
                  <Check className="size-3.5" /> Use for {PLATFORM_RULES[c.platform].label}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onUseMain(full(c))}>
                  Use as main text
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    navigator.clipboard.writeText(full(c)).then(() => toast.success('Copied'))
                  }
                  aria-label="Copy"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
