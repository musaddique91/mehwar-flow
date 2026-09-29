'use client';

import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_RULES, type Platform } from '@mehwar/shared';
import { FadeIn } from '@/components/motion';
import { Button, Card, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';
import { PlatformIcon } from '@/lib/platforms';

interface Pending {
  platform: Platform;
  accounts: {
    externalId: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
  }[];
}

function SelectInner() {
  const params = useSearchParams();
  const router = useRouter();
  const session = params.get('session');
  const { data, error } = useApi<Pending>(session ? `/channels/pending/${session}` : null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/channels/pending/${session}`, { method: 'POST', json: { externalIds: chosen } });
      toast.success(`${chosen.length} account${chosen.length > 1 ? 's' : ''} connected 🎉`);
      invalidate('channels');
      router.replace('/channels');
    } catch (err) {
      toast.error((err as ApiError).message);
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Card className="mx-auto mt-10 max-w-md text-center text-sm">
        {error.message}
        <Button className="mt-4" onClick={() => router.replace('/channels')}>
          Back to channels
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-4">
      <FadeIn>
        <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight">
          {data && <PlatformIcon platform={data.platform} className="size-6" />}
          Choose accounts to connect
        </h1>
        <p className="mt-1 text-sm text-muted">
          {data
            ? `We found ${data.accounts.length} ${PLATFORM_RULES[data.platform].label} accounts you manage.`
            : 'Loading your accounts…'}
        </p>
      </FadeIn>
      <div className="space-y-2">
        {!data
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          : data.accounts.map((a, i) => {
              const on = chosen.includes(a.externalId);
              return (
                <motion.button
                  key={a.externalId}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    setChosen((c) =>
                      on ? c.filter((x) => x !== a.externalId) : [...c, a.externalId],
                    )
                  }
                  className={cn(
                    'glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition',
                    on && 'ring-2 ring-fuchsia-500',
                  )}
                >
                  {a.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatarUrl} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-line">
                      <PlatformIcon platform={data.platform} className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.displayName}</span>
                    {a.username && <span className="block text-xs text-muted">@{a.username}</span>}
                  </span>
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full border-2',
                      on ? 'brand-gradient border-transparent text-white' : 'border-line',
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </motion.button>
              );
            })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.replace('/channels')}>
          Cancel
        </Button>
        <Button onClick={save} loading={busy} disabled={chosen.length === 0}>
          Connect {chosen.length || ''}
        </Button>
      </div>
    </div>
  );
}

export default function SelectAccountsPage() {
  return (
    <Suspense>
      <SelectInner />
    </Suspense>
  );
}
