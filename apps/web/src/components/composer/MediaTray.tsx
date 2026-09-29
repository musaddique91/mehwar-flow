'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Film, Loader2, TriangleAlert, X } from 'lucide-react';
import type { MediaDto } from '@mehwar/shared';
import { cn } from '@/lib/cn';

export interface PendingUpload {
  key: string;
  name: string;
  progress: number;
}

export function MediaTray({
  media,
  uploads,
  onRemove,
}: {
  media: MediaDto[];
  uploads: PendingUpload[];
  onRemove: (id: string) => void;
}) {
  if (media.length === 0 && uploads.length === 0) return null;
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 sm:px-5">
      <AnimatePresence initial={false}>
        {media.map((m) => (
          <motion.div
            key={m.id}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="group relative size-24 shrink-0 overflow-hidden rounded-2xl border border-line bg-line"
          >
            {m.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.thumbnailUrl} alt={m.fileName} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted">
                {m.kind === 'video' ? (
                  <Film className="size-6" />
                ) : (
                  <Loader2 className="size-6 animate-spin" />
                )}
              </div>
            )}
            {m.kind === 'video' && m.durationSec != null && (
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">
                {Math.round(m.durationSec)}s
              </span>
            )}
            {m.status === 'PROCESSING' || m.status === 'UPLOADING' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-semibold text-white">
                <Loader2 className="mr-1 size-3 animate-spin" /> Processing
              </div>
            ) : null}
            {m.status === 'FAILED' && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-red-950/70 p-1 text-center text-[10px] text-white"
                title={m.processingError ?? ''}
              >
                <TriangleAlert className="size-4" /> Failed
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(m.id)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              aria-label={`Remove ${m.fileName}`}
            >
              <X className="size-3" />
            </button>
          </motion.div>
        ))}
        {uploads.map((u) => (
          <motion.div
            key={u.key}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex size-24 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-fuchsia-400/50 p-2"
          >
            <span className="w-full truncate text-center text-[10px] text-muted">{u.name}</span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <motion.div
                className={cn('h-full rounded-full brand-gradient')}
                animate={{ width: `${Math.round(u.progress * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums">
              {Math.round(u.progress * 100)}%
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
