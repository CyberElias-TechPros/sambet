'use client';

import React, { useState } from 'react';
import { KeyRound, Info } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button, Card, CardHeader, Field, Input } from '@/components/ui/primitives';
import { initials } from '@/lib/format';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.changePassword({ current, next });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('success', 'Password updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">Manage your account and view system information.</p>
      </div>

      <Card>
        <CardHeader title="Your account" />
        <div className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-leaf-50 text-[16px] font-bold text-leaf-700 ring-1 ring-leaf-200">
            {user ? initials(user.name) : '·'}
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">{user?.name}</p>
            <p className="text-[13px] text-ink-soft">{user?.email} · role: {user?.role}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Change password" subtitle="Use at least 8 characters, with letters and numbers." />
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <Field label="Current password" required>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" required>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" required>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            </Field>
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              <KeyRound className="h-4 w-4" /> Update password
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="About this deployment" />
        <div className="space-y-2.5 p-5 text-[13.5px] leading-relaxed text-ink-soft">
          <p className="flex gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" />
            <span>
              Frontend on <strong className="font-semibold text-ink">Vercel</strong>, API on <strong className="font-semibold text-ink">Cloudflare Workers</strong> with a D1 database.
              The browser only ever talks to this site’s own <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px]">/api</code> routes, which are
              proxied to the Worker — your session cookie never leaves this domain.
            </span>
          </p>
          <p className="flex gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" />
            <span>
              Original import files are archived in Cloudflare R2 for audit, and every change is written to the audit log.
            </span>
          </p>
        </div>
      </Card>
    </div>
  );
}
