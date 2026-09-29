'use client';

import { CalendarClock, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { utcToZonedLocal, zonedLocalToUtc } from '@mehwar/shared';
import { Button, Modal } from '@/components/ui';
import { api } from '@/lib/api';

function defaultLocal(timezone: string): string {
  const inAnHour = new Date(Date.now() + 60 * 60_000);
  inAnHour.setMinutes(0, 0, 0);
  return utcToZonedLocal(inAnHour, timezone);
}

export function ScheduleModal({
  open,
  timezone,
  initial,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  timezone: string;
  initial?: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (localDateTime: string) => void;
}) {
  const [value, setValue] = useState(() => initial ?? defaultLocal(timezone));
  const [finding, setFinding] = useState(false);

  useEffect(() => {
    if (open) setValue(initial ?? defaultLocal(timezone));
  }, [open, initial, timezone]);

  const [date, time] = value.split('T') as [string, string];
  let when: string | null = null;
  let past = false;
  try {
    const utc = zonedLocalToUtc(value, timezone);
    past = utc.getTime() < Date.now();
    when = utc.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
  } catch {
    when = null;
  }

  async function nextSlot() {
    setFinding(true);
    try {
      const res = await api<{ localDateTime: string | null }>('/slots/next-free');
      if (res.localDateTime) setValue(res.localDateTime);
      else
        toast('No posting slots yet', {
          description: 'Add your usual posting times on the Calendar page.',
        });
    } finally {
      setFinding(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule post">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setValue(`${e.target.value}T${time}`)}
              className="w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 outline-none focus:ring-4 focus:ring-[var(--ring)]"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setValue(`${date}T${e.target.value}`)}
              className="w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 outline-none focus:ring-4 focus:ring-[var(--ring)]"
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          Times are in <b className="text-fg">{timezone.replace(/_/g, ' ')}</b>
          {when ? <> · your device shows this as {when}</> : null}
        </p>
        {past && <p className="text-xs text-red-400">That time has already passed.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={nextSlot} loading={finding}>
            <Sparkles className="size-4" /> Next free slot
          </Button>
          <Button onClick={() => onConfirm(value)} loading={busy} disabled={past || !when}>
            <CalendarClock className="size-4" /> Schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
