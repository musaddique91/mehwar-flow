'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, ImagePlus, Send, Smile, Sparkles, TriangleAlert, Info } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  countCharacters,
  hasBlockingIssues,
  maxTextLength,
  PLATFORM_RULES,
  PLATFORMS,
  validateForPlatform,
  type Platform,
  type UserDto,
} from '@mehwar/shared';
import { Avatar, Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';
import { PostPreview } from './PostPreview';

/** Circular character counter, like X's. */
export function CharRing({
  count,
  limit,
  size = 26,
}: {
  count: number;
  limit: number;
  size?: number;
}) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.min(count / limit, 1);
  const remaining = limit - count;
  const color =
    remaining < 0 ? '#ef4444' : remaining <= Math.max(10, limit * 0.1) ? '#f59e0b' : '#d946ef';
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={2.5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - ratio), stroke: color }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </svg>
      {remaining <= Math.max(10, limit * 0.1) && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute text-[9px] font-bold tabular-nums"
          style={{ color }}
        >
          {remaining < -99 ? '-99+' : remaining}
        </motion.span>
      )}
    </span>
  );
}

const DEFAULT_SELECTION: Platform[] = ['x', 'instagram', 'threads', 'facebook'];

export function Composer({ user }: { user: UserDto }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<Platform[]>(DEFAULT_SELECTION);
  const [preview, setPreview] = useState<Platform>('x');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expanded = focused || text.length > 0;
  const handle =
    user.email
      .split('@')[0]!
      .replace(/[^a-z0-9_.]/gi, '')
      .toLowerCase() || 'you';

  const issues = useMemo(
    () =>
      selected.flatMap((p) =>
        validateForPlatform(p, { text, media: [], extendedTextLimit: user.xPremium }),
      ),
    [selected, text, user.xPremium],
  );
  const blocking = hasBlockingIssues(issues);
  const count = countCharacters(text);
  const activePreview = selected.includes(preview) ? preview : (selected[0] ?? 'x');

  function toggle(p: Platform) {
    setSelected((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
    setPreview(p);
  }

  function notYet(action: string) {
    toast.info(`${action} arrives in the next update`, {
      description: 'Connect channels and publishing are being built right now.',
    });
  }

  return (
    <Card id="compose" layout className="scroll-mt-24 bg-card-strong p-0">
      <div className="flex gap-3 p-4 sm:p-5">
        <Avatar name={user.name} size={44} />
        <div className="min-w-0 flex-1">
          <motion.textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="What’s on your mind?"
            aria-label="Post text"
            animate={{ height: expanded ? 140 : 52 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full resize-none bg-transparent pt-2.5 text-base leading-relaxed outline-none placeholder:text-muted/70 sm:text-lg"
          />
        </div>
      </div>

      {/* Network chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 sm:px-5">
        {PLATFORMS.map((p) => {
          const on = selected.includes(p);
          const limit = maxTextLength(p, user.xPremium);
          return (
            <motion.button
              key={p}
              whileTap={{ scale: 0.92 }}
              onClick={() => toggle(p)}
              aria-pressed={on}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm font-semibold transition-colors',
                on
                  ? 'border-transparent bg-fg text-[var(--bg)]'
                  : 'border-line text-muted hover:text-fg',
              )}
            >
              <span
                className="flex size-7 items-center justify-center rounded-full text-white"
                style={{ background: on ? PLATFORM_BRAND[p].gradient : 'var(--line)' }}
              >
                <PlatformIcon platform={p} className="size-3.5" />
              </span>
              {PLATFORM_RULES[p].label}
              <AnimatePresence>
                {on && (
                  <motion.span
                    initial={{ scale: 0, width: 0 }}
                    animate={{ scale: 1, width: 'auto' }}
                    exit={{ scale: 0, width: 0 }}
                  >
                    <CharRing count={count} limit={limit} size={22} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Issues */}
      <AnimatePresence initial={false}>
        {text.length > 0 && issues.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5 overflow-hidden px-4 pb-3 sm:px-5"
          >
            {issues.map((i) => (
              <motion.li
                key={`${i.platform}-${i.code}`}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium',
                  i.severity === 'error'
                    ? 'bg-red-500/10 text-red-500 dark:text-red-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                )}
              >
                {i.severity === 'error' ? (
                  <TriangleAlert className="size-3.5 shrink-0" />
                ) : (
                  <Info className="size-3.5 shrink-0" />
                )}
                <PlatformIcon platform={i.platform} className="size-3 shrink-0" />
                {i.message}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Previews */}
      <AnimatePresence initial={false}>
        {expanded && selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-line"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-1 px-4 pt-3 sm:px-5">
              <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Preview
              </span>
              {selected.map((p) => (
                <button
                  key={p}
                  onClick={() => setPreview(p)}
                  className="relative rounded-full px-3 py-1.5"
                  aria-label={`Preview on ${PLATFORM_RULES[p].label}`}
                >
                  {activePreview === p && (
                    <motion.span
                      layoutId="preview-tab"
                      className="absolute inset-0 rounded-full bg-line"
                    />
                  )}
                  <PlatformIcon
                    platform={p}
                    className={cn(
                      'relative size-4',
                      activePreview === p ? 'text-fg' : 'text-muted',
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="px-4 py-4 sm:px-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePreview}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="mx-auto max-w-md"
                >
                  <PostPreview
                    platform={activePreview}
                    text={text}
                    name={user.name}
                    handle={handle}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-0.5">
          {[
            { icon: ImagePlus, label: 'Add photo or video', action: 'The media library' },
            { icon: Smile, label: 'Emoji', action: 'Emoji picker' },
            { icon: Sparkles, label: 'Write with AI', action: 'The AI caption helper' },
          ].map(({ icon: Icon, label, action }) => (
            <motion.button
              key={label}
              whileHover={{ scale: 1.12, rotate: -6 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => notYet(action)}
              className="rounded-full p-2.5 text-fuchsia-500 transition hover:bg-fuchsia-500/10 dark:text-fuchsia-400"
              aria-label={label}
            >
              <Icon className="size-5" />
            </motion.button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!text.trim() || blocking || selected.length === 0}
            onClick={() => notYet('Scheduling')}
          >
            <CalendarClock className="size-4" /> <span className="hidden sm:inline">Schedule</span>
          </Button>
          <Button
            size="sm"
            disabled={!text.trim() || blocking || selected.length === 0}
            onClick={() => notYet('Publishing')}
          >
            <Send className="size-4" /> Post
          </Button>
        </div>
      </div>
    </Card>
  );
}
