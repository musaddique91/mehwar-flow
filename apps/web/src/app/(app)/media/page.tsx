'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Film, Loader2, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { MediaDto } from '@mehwar/shared';
import { FadeIn } from '@/components/motion';
import { Button, Card, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { invalidate, useApi } from '@/lib/hooks';
import { formatBytes, uploadMedia } from '@/lib/media';

export default function MediaPage() {
  const { data } = useApi<MediaDto[]>('/media', ['media']);
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([]);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    for (const file of Array.from(files)) {
      setUploading((u) => [...u, { name: file.name, progress: 0 }]);
      try {
        await uploadMedia(file, (p) =>
          setUploading((u) => u.map((x) => (x.name === file.name ? { ...x, progress: p } : x))),
        );
        invalidate('media');
      } catch (err) {
        toast.error(`Could not upload ${file.name}`, { description: (err as ApiError).message });
      } finally {
        setUploading((u) => u.filter((x) => x.name !== file.name));
      }
    }
  }

  async function remove(m: MediaDto) {
    try {
      await api(`/media/${m.id}`, { method: 'DELETE' });
      invalidate('media');
      toast.success('Deleted');
    } catch (err) {
      toast.error((err as ApiError).message);
    }
  }

  const total = (data ?? []).reduce((sum, m) => sum + m.sizeBytes, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-2">
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Media library</h1>
          <p className="mt-1 text-sm text-muted">
            {data ? `${data.length} files · ${formatBytes(total)}` : 'Loading…'}
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <Button onClick={() => input.current?.click()}>
          <Upload className="size-4" /> Upload
        </Button>
      </FadeIn>

      {uploading.length > 0 && (
        <Card className="space-y-2">
          {uploading.map((u) => (
            <div key={u.name} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="brand-gradient h-full"
                  animate={{ width: `${u.progress * 100}%` }}
                />
              </div>
            </div>
          ))}
        </Card>
      )}

      {data === undefined ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted">
          No media yet. Upload photos and videos to reuse them in posts.
        </Card>
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence>
            {data.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -4 }}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-line"
              >
                {m.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnailUrl} alt={m.fileName} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted">
                    {m.status === 'FAILED' ? (
                      <TriangleAlert className="size-6 text-red-400" />
                    ) : m.kind === 'video' ? (
                      <Film className="size-6" />
                    ) : (
                      <Loader2 className="size-6 animate-spin" />
                    )}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-[11px] text-white">
                  <p className="truncate font-semibold">{m.fileName}</p>
                  <p className="opacity-80">
                    {m.status !== 'READY'
                      ? m.status.toLowerCase()
                      : [
                          m.width && `${m.width}×${m.height}`,
                          m.durationSec && `${Math.round(m.durationSec)}s`,
                          formatBytes(m.sizeBytes),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Delete ${m.fileName}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
