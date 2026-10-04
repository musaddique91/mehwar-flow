'use client';

import { KeyRound, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function SecurityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { logout } = useAuth();
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api('/me/password', {
        method: 'POST',
        json: { currentPassword: current, newPassword: next },
      });
      toast.success('Password updated successfully', {
        description: 'Please sign in with your new password.',
      });
      onClose();
      await logout();
      router.replace('/login');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrors({ current: 'Current password is incorrect' });
      } else if (err instanceof ApiError && err.errors) {
        setErrors({
          next: err.errors.find((x) => x.path === 'newPassword')?.message ?? err.message,
        });
      } else {
        toast.error('Could not change password', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Security & Password" maxWidth="max-w-md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-fuchsia-500/10 p-3.5 border border-fuchsia-500/20">
          <span className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-fg">Update Password</h3>
            <p className="text-xs text-muted">Changing your password will sign you out everywhere.</p>
          </div>
        </div>

        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          icon={<Lock className="size-4" />}
          error={errors.current}
          required
        />

        <Input
          label="New password (min 10 characters)"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          icon={<Lock className="size-4" />}
          error={errors.next}
          required
        />

        <div className="flex justify-end gap-2 pt-3 border-t border-line/60">
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="secondary"
            loading={busy}
            disabled={!current || next.length < 10}
          >
            Update password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
