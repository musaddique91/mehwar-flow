'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Clock, FileUp, Plus, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { utcToZonedLocal, zonedLocalToUtc, type PostDto } from '@mehwar/shared';
import { FadeIn } from '@/components/motion';
import { Button, Card, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';
import { PlatformIcon } from '@/lib/platforms';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Calendar maths on plain "YYYY-MM-DD" strings (time-zone free). */
const day = {
  parse: (d: string) => new Date(`${d}T00:00:00Z`),
  fmt: (d: Date) => d.toISOString().slice(0, 10),
  add: (d: string, n: number) => day.fmt(new Date(day.parse(d).getTime() + n * 86_400_000)),
  weekday: (d: string) => day.parse(d).getUTCDay(),
};

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  PUBLISHING: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border-fuchsia-500/30',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  PARTIALLY_FAILED: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  FAILED: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
  DRAFT: 'bg-line text-muted border-line',
};

interface Slot {
  id: string;
  weekday: number;
  minuteOfDay: number;
}

function SlotsCard() {
  const { data } = useApi<Slot[]>('/slots', ['slots']);
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState('09:00');
  const add = async () => {
    const [h, m] = time.split(':').map(Number) as [number, number];
    try {
      await api('/slots', { method: 'POST', json: { weekday, minuteOfDay: h * 60 + m } });
      invalidate('slots');
    } catch (err) {
      toast.error((err as ApiError).message);
    }
  };
  const remove = async (id: string) => {
    await api(`/slots/${id}`, { method: 'DELETE' });
    invalidate('slots');
  };
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Clock className="size-4 text-fuchsia-400" /> Posting slots
        </h3>
        <p className="text-xs text-muted">
          Your usual posting times. “Next free slot” in the composer picks the earliest open one.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
          className="rounded-xl border border-line bg-elevated/60 px-2 py-1.5 text-sm"
        >
          {WEEKDAYS.map((w, i) => (
            <option key={w} value={i}>
              {w}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-xl border border-line bg-elevated/60 px-2 py-1.5 text-sm"
        />
        <Button size="sm" onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence>
          {(data ?? []).map((s) => (
            <motion.span
              key={s.id}
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-line px-2.5 py-1 text-xs font-semibold"
            >
              {WEEKDAYS[s.weekday]} {String(Math.floor(s.minuteOfDay / 60)).padStart(2, '0')}:
              {String(s.minuteOfDay % 60).padStart(2, '0')}
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label="Remove slot"
                className="text-muted hover:text-red-500"
              >
                <Trash2 className="size-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [csv, setCsv] = useState('text,date,channels\n"Hello world!",2026-10-01 09:00,x|instagram');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    results: { row: number; error?: string }[];
  } | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      const res = await api<typeof result>('/posts/import', { method: 'POST', json: { csv } });
      setResult(res);
      invalidate('posts');
      toast.success(`Imported ${res!.imported} posts`);
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Import posts from CSV">
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted">
          Columns: <code>text</code> (required), <code>date</code> (“YYYY-MM-DD HH:mm” in your time
          zone; empty = draft), <code>channels</code> (e.g. <code>x|instagram</code> or{' '}
          <code>all</code>), <code>first_comment</code>.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setCsv(await f.text());
          }}
          className="text-xs"
        />
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-line bg-elevated/60 p-3 font-mono text-xs outline-none"
        />
        {result && (
          <div className="space-y-1 rounded-xl bg-line/60 p-3 text-xs">
            <p className="font-semibold">{result.imported} imported</p>
            {result.results
              .filter((r) => r.error)
              .map((r) => (
                <p key={r.row} className="text-red-400">
                  Row {r.row}: {r.error}
                </p>
              ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={run} loading={busy}>
            <FileUp className="size-4" /> Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const isDraggingRef = useRef(false);
  const { user } = useAuth();
  const tz = user?.timezone ?? 'UTC';
  const today = utcToZonedLocal(new Date(), tz).slice(0, 10);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [anchor, setAnchor] = useState(today);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const handlePostClick = (p: PostDto) => {
    if (isDraggingRef.current) return;
    const isFuture =
      p.status === 'SCHEDULED' ||
      (p.scheduledAt && new Date(p.scheduledAt).getTime() > Date.now());

    if (isFuture) {
      router.push(`/schedules?postId=${p.id}#post-${p.id}`);
    } else {
      router.push(`/dashboard?postId=${p.id}#post-${p.id}`);
    }
  };

  const days = useMemo(() => {
    if (view === 'week') {
      const start = day.add(anchor, -day.weekday(anchor));
      return Array.from({ length: 7 }, (_, i) => day.add(start, i));
    }
    const first = `${anchor.slice(0, 7)}-01`;
    const start = day.add(first, -day.weekday(first));
    return Array.from({ length: 42 }, (_, i) => day.add(start, i));
  }, [anchor, view]);

  const from = zonedLocalToUtc(`${days[0]}T00:00`, tz).toISOString();
  const to = zonedLocalToUtc(`${day.add(days.at(-1)!, 1)}T00:00`, tz).toISOString();
  const { data: posts } = useApi<PostDto[]>(`/posts?from=${from}&to=${to}&limit=500`, ['posts']);

  const byDay = useMemo(() => {
    const map = new Map<string, (PostDto & { local: string })[]>();
    for (const p of posts ?? []) {
      if (!p.scheduledAt) continue;
      const local = utcToZonedLocal(new Date(p.scheduledAt), tz);
      const key = local.slice(0, 10);
      map.set(
        key,
        [...(map.get(key) ?? []), { ...p, local }].sort((a, b) => a.local.localeCompare(b.local)),
      );
    }
    return map;
  }, [posts, tz]);

  const move = (n: number) => {
    if (view === 'week') setAnchor(day.add(anchor, n * 7));
    else {
      const d = day.parse(`${anchor.slice(0, 7)}-01`);
      d.setUTCMonth(d.getUTCMonth() + n);
      setAnchor(day.fmt(d));
    }
  };

  async function onDrop(e: DragEvent, target: string) {
    e.preventDefault();
    setDragOver(null);
    const { id, local } = JSON.parse(e.dataTransfer.getData('application/json')) as {
      id: string;
      local: string;
    };
    if (local.slice(0, 10) === target) return;
    const next = `${target}T${local.slice(11, 16)}`;
    if (zonedLocalToUtc(next, tz).getTime() < Date.now())
      return toast.error('Pick a day in the future');
    try {
      await api(`/posts/${id}/schedule`, {
        method: 'POST',
        json: { localDateTime: next, timezone: tz },
      });
      toast.success(
        `Moved to ${new Date(`${target}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`,
      );
      invalidate('posts');
    } catch (err) {
      toast.error((err as ApiError).message);
    }
  }

  const title =
    view === 'month'
      ? day
          .parse(`${anchor.slice(0, 7)}-01`)
          .toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : `${day.parse(days[0]!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${day
          .parse(days[6]!)
          .toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          })}`;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <FadeIn className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="glass flex rounded-full p-1">
              {(['month', 'week'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className="relative rounded-full px-3 py-1 text-sm font-semibold capitalize"
                >
                  {view === v && (
                    <motion.span
                      layoutId="cal-view"
                      className="absolute inset-0 rounded-full bg-card-strong shadow-sm"
                    />
                  )}
                  <span className={cn('relative', view === v ? 'text-fg' : 'text-muted')}>{v}</span>
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => move(-1)} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAnchor(today)}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => move(1)} aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </FadeIn>

        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-line text-center text-xs font-semibold uppercase tracking-wider text-muted">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <motion.div
            key={`${view}-${days[0]}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="grid grid-cols-7"
          >
            {days.map((d) => {
              const inMonth = view === 'week' || d.slice(0, 7) === anchor.slice(0, 7);
              const items = byDay.get(d) ?? [];
              const past = d < today;
              return (
                <div
                  key={d}
                  onDragOver={(e) => {
                    if (past) return;
                    e.preventDefault();
                    setDragOver(d);
                  }}
                  onDragLeave={() => setDragOver((cur) => (cur === d ? null : cur))}
                  onDrop={(e) => onDrop(e, d)}
                  className={cn(
                    'min-h-24 border-b border-r border-line p-1.5 transition-colors sm:min-h-28',
                    view === 'week' && 'min-h-80',
                    !inMonth && 'bg-line/30 text-muted/60',
                    dragOver === d && 'bg-fuchsia-500/10',
                  )}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                        d === today && 'brand-gradient text-white',
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </div>
                    <div className="space-y-1">
                    {items.slice(0, view === 'week' ? 20 : 3).map((p) => {
                      const draggable = p.status === 'SCHEDULED';
                      const isFuture =
                        p.status === 'SCHEDULED' ||
                        (p.scheduledAt && new Date(p.scheduledAt).getTime() > Date.now());

                      return (
                        <div
                          key={p.id}
                          draggable={draggable}
                          onDragStart={(e) => {
                            isDraggingRef.current = true;
                            e.dataTransfer.setData(
                              'application/json',
                              JSON.stringify({ id: p.id, local: p.local }),
                            );
                          }}
                          onDragEnd={() => {
                            setTimeout(() => {
                              isDraggingRef.current = false;
                            }, 150);
                          }}
                          onClick={() => handlePostClick(p)}
                          className={cn(
                            'rounded-lg border px-1.5 py-1 text-[11px] leading-tight transition-all duration-150',
                            'cursor-pointer hover:scale-[1.03] hover:shadow-md hover:ring-2 hover:ring-primary/50',
                            STATUS_COLOR[p.status],
                            draggable && 'cursor-grab active:cursor-grabbing',
                          )}
                          title={`${p.text || 'Media post'} • Click to view in ${isFuture ? 'My Schedules' : 'Home'}`}
                        >
                          <div className="flex items-center gap-1 font-semibold">
                            {p.local.slice(11, 16)}
                            <span className="flex gap-0.5">
                              {[...new Set(p.targets.map((t) => t.platform))].map((pl) => (
                                <PlatformIcon key={pl} platform={pl} className="size-2.5" />
                              ))}
                            </span>
                          </div>
                          <p className="truncate">{p.text || 'Media post'}</p>
                        </div>
                      );
                    })}
                    {items.length > 3 && view === 'month' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnchor(d);
                          setView('week');
                        }}
                        className="w-full text-left px-1 text-[10px] text-muted hover:text-primary transition font-semibold"
                      >
                        +{items.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </Card>
        <p className="text-xs text-muted">
          Drag a scheduled post to another day to move it (the time stays the same). Times are in{' '}
          {tz.replace(/_/g, ' ')}.
        </p>
      </div>

      <aside className="space-y-4">
        <SlotsCard />
        <Card className="space-y-2">
          <h3 className="text-sm font-bold">Bulk import</h3>
          <p className="text-xs text-muted">
            Plan a month of posts in a spreadsheet and import them at once.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
            <FileUp className="size-4" /> Import CSV
          </Button>
        </Card>
      </aside>
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
