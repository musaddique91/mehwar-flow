'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Smile } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const EMOJIS = [
  '😀',
  '😂',
  '🥹',
  '😍',
  '🤩',
  '😎',
  '🤔',
  '🙌',
  '👏',
  '🙏',
  '💪',
  '👀',
  '🔥',
  '✨',
  '🎉',
  '🎊',
  '💯',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '⭐',
  '🌟',
  '⚡',
  '🚀',
  '📣',
  '📢',
  '📸',
  '🎥',
  '🎬',
  '🎵',
  '🌴',
  '☀️',
  '🌙',
  '🍕',
  '☕',
  '🏆',
  '✅',
  '👉',
  '👇',
  '💡',
  '📈',
  '🛍️',
  '💸',
  '🎁',
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        whileHover={{ scale: 1.12, rotate: -6 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-2.5 text-fuchsia-500 transition hover:bg-fuchsia-500/10 dark:text-fuchsia-400"
        aria-label="Insert emoji"
      >
        <Smile className="size-5" />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="glass absolute bottom-12 left-0 z-40 grid w-72 grid-cols-8 gap-1 rounded-2xl bg-card-strong p-2 shadow-2xl"
          >
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onPick(e)}
                className="rounded-lg p-1 text-xl transition hover:scale-125 hover:bg-line"
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
