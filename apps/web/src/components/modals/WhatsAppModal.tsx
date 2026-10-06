'use client';

import { CheckCircle2, Loader2, MessageSquare, QrCode, RefreshCw, Settings, Unplug } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { WhatsAppStatusDto } from '@mehwar/shared';
import { Button, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { invalidate } from '@/lib/hooks';

export function WhatsAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<WhatsAppStatusDto>({ status: 'DISCONNECTED' });
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api<WhatsAppStatusDto>('/whatsapp/status');
      setStatus(res);
      return res;
    } catch {
      return null;
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await api<WhatsAppStatusDto>('/whatsapp/connect', { method: 'POST' });
      setStatus(res);
      setPolling(true);
    } catch (err) {
      toast.error('Could not initiate WhatsApp connection', {
        description: (err as ApiError).message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api('/whatsapp/disconnect', { method: 'POST' });
      setStatus({ status: 'DISCONNECTED' });
      setPolling(false);
      invalidate('channels', 'whatsapp');
      toast.success('WhatsApp disconnected');
    } catch (err) {
      toast.error('Could not disconnect WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setPolling(false);
      return;
    }

    void fetchStatus().then((s) => {
      if (s?.status === 'SCAN_QR_CODE') {
        setPolling(true);
      } else if (s?.status === 'DISCONNECTED') {
        void handleConnect();
      }
    });
  }, [open]);

  // Polling for QR scan & ready state
  useEffect(() => {
    if (!open || !polling || status.status === 'CONNECTED') return;

    const timer = setInterval(async () => {
      const s = await fetchStatus();
      if (s?.status === 'CONNECTED') {
        setPolling(false);
        invalidate('channels', 'whatsapp');
        toast.success('WhatsApp connected successfully! 🎉');
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [open, polling, status.status]);

  return (
    <Modal open={open} onClose={onClose} title="WhatsApp Web Connection" maxWidth="max-w-md">
      <div className="space-y-5 text-center">
        {status.status === 'CONNECTED' ? (
          <div className="space-y-4 py-4">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/10">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-fg">WhatsApp Connected</h3>
              <p className="text-xs text-muted mt-1">
                {status.phone ? `Linked to phone number: +${status.phone}` : 'Active session linked.'}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-card/60 p-3.5 text-xs text-muted text-left space-y-1">
              <p className="font-semibold text-fg">✅ Added to Channels & delivery active</p>
              <p>Your WhatsApp channel is now active. You can dispatch video and social links directly to your customers and groups without leaving Mehwar Flow.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Link href="/settings?tab=whatsapp" onClick={onClose}>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Settings className="size-3.5" /> WhatsApp Settings
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button variant="danger" size="sm" onClick={handleDisconnect} loading={loading}>
                <Unplug className="size-4" /> Disconnect
              </Button>
            </div>
          </div>
        ) : status.status === 'SCAN_QR_CODE' && status.qrCodeDataUrl ? (
          <div className="space-y-4 py-2">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <QrCode className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg">Scan WhatsApp QR Code</h3>
              <p className="text-xs text-muted mt-0.5">
                Open WhatsApp on your phone and link this device
              </p>
            </div>

            <div className="mx-auto w-fit p-3 bg-white rounded-2xl shadow-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={status.qrCodeDataUrl}
                alt="WhatsApp QR Code"
                className="size-56 object-contain rounded-lg"
              />
            </div>

            <div className="rounded-2xl bg-elevated/70 border border-line p-3 text-left text-xs text-muted space-y-1.5">
              <p className="font-semibold text-fg text-xs">How to scan:</p>
              <ol className="list-decimal list-inside space-y-1 text-[11px]">
                <li>Open <b>WhatsApp</b> on your phone</li>
                <li>Tap <b>Settings</b> or <b>⋮ Menu</b> &rarr; <b>Linked Devices</b></li>
                <li>Tap <b>Link a Device</b> and point camera at the QR code</li>
              </ol>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={handleConnect} loading={loading}>
                <RefreshCw className="size-3.5" /> Refresh QR
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-8">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
              <MessageSquare className="size-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg">Connect WhatsApp Web</h3>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                Pair your WhatsApp account to enable automated WhatsApp video sharing directly to your customers.
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={handleConnect} loading={loading} className="gap-2 mx-auto">
                <QrCode className="size-4" /> Start QR Pairing
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
