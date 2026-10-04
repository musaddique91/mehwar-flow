'use client';

import { Download, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal } from '@/components/ui';
import { api, ApiError, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyExport, setBusyExport] = useState(false);

  const handleExport = async () => {
    setBusyExport(true);
    try {
      await downloadFile('/me/export', 'mehwar-export.json');
      toast.success('Data exported successfully');
    } catch {
      toast.error('Export failed');
    } finally {
      setBusyExport(false);
    }
  };

  const handleDelete = async () => {
    setBusyDelete(true);
    try {
      await api('/me', { method: 'DELETE', json: { password } });
      toast('Your account was permanently deleted. Goodbye 👋');
      setConfirmOpen(false);
      onClose();
      await logout();
      router.replace('/login');
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to delete account');
      setBusyDelete(false);
    }
  };

  return (
    <>
      <Modal open={open && !confirmOpen} onClose={onClose} title="Privacy & Data" maxWidth="max-w-md">
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-3.5 border border-primary/20">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-fg">Your Privacy & Data</h3>
              <p className="text-xs text-muted">Download your personal data archive or delete your account.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-line p-4 space-y-2 bg-card/40">
              <h4 className="text-sm font-semibold text-fg">Export Data Archive</h4>
              <p className="text-xs text-muted">
                Download a JSON archive containing your profile, channel connections, posts, media assets, and audit logs.
              </p>
              <Button
                variant="secondary"
                size="sm"
                loading={busyExport}
                onClick={handleExport}
                className="gap-2"
              >
                <Download className="size-4" /> Export my data
              </Button>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-red-500">Danger Zone</h4>
              <p className="text-xs text-muted">
                Permanently delete your Mehwar Flow account, channels, scheduled posts, and media library.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                className="gap-2"
              >
                <Trash2 className="size-4" /> Delete account
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-line/60">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete your account?" maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            This disconnects every social channel, cancels scheduled posts, and permanently deletes your posts, media, and settings.
            <span className="block mt-1 font-semibold text-red-500">This action cannot be undone.</span>
          </p>
          <Input
            label="Confirm with your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="size-4" />}
            placeholder="Your password"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-line/60">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busyDelete}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={busyDelete} disabled={!password}>
              Delete forever
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
