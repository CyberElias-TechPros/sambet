'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Plus, ShieldCheck, UserPlus, Users, Copy, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { TeamMember } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Field, Input, Select, Skeleton } from '@/components/ui/primitives';
import { Modal, ConfirmDialog } from '@/components/ui/overlays';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { initials } from '@/lib/format';

function randomPassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = lower + upper + digits + symbols;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const pick = (s: string, i: number) => s.charAt(bytes[i % bytes.length] % s.length);
  const chars = [pick(lower, 0), pick(upper, 1), pick(digits, 2), pick(symbols, 3)];
  for (let i = 0; i < 12; i++) chars.push(pick(all, 4 + i));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = (bytes[(i + 7) % bytes.length] + bytes[(i + 11) % bytes.length]) % (i + 1);
    const a = chars[i] ?? '';
    const b = chars[j] ?? '';
    chars[i] = b;
    chars[j] = a;
  }
  return chars.join('');
}

/** Generate a client-side temp password that satisfies the API policy, so the
 *  “Add member” flow works even if you prefer not to type one in. */
function useTempPassword() {
  const [pw, setPw] = useState(() => randomPassword());
  return { password: pw, regenerate: () => setPw(randomPassword()) };
}

export default function TeamPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const isAdmin = me?.role === 'admin';

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('editor');
  const { password, regenerate } = useTempPassword();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    api.listUsers().then((r) => setMembers(r.data)).catch(() => setMembers([]));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Team</h1>
        <Card className="p-10 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-ink-faint" />
          <p className="text-sm font-medium text-ink">Administrators only</p>
          <p className="mt-1 text-[13px] text-ink-soft">Ask an admin to manage team accounts and import approvals.</p>
        </Card>
      </div>
    );
  }

  async function addMember() {
    setFieldErrors({});
    setBusy(true);
    try {
      await api.createUser({ name: name.trim(), email: email.trim(), password, role });
      toast('success', `${name.trim()} added as ${role}. Share the temporary password now — it is shown once.`);
      setAddOpen(false);
      setName('');
      setEmail('');
      setRole('editor');
      regenerate();
      setTempPw(password);
      const r = await api.listUsers();
      setMembers(r.data);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fields ?? {});
        if (!e.fields) toast('error', e.message);
      } else toast('error', 'Could not add member.');
    } finally {
      setBusy(false);
    }
  }

  async function setMemberRole(m: TeamMember, newRole: 'admin' | 'editor') {
    try {
      await api.updateUser(m.id, { role: newRole });
      toast('success', `${m.name} is now ${newRole === 'admin' ? 'an admin' : 'a staff editor'}.`);
      const r = await api.listUsers();
      setMembers(r.data);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Update failed.');
    }
  }

  async function setDisabled(m: TeamMember, disabled: boolean) {
    try {
      await api.updateUser(m.id, { disabled });
      toast('success', disabled ? `${m.name} disabled — they are signed out immediately.` : `${m.name} re-enabled.`);
      const r = await api.listUsers();
      setMembers(r.data);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Update failed.');
    }
  }

  async function doReset() {
    if (!resetTarget) return;
    setBusy(true);
    try {
      const { data } = await api.resetUserPassword(resetTarget.id);
      setResetTarget(null);
      setTempPw(data.tempPassword);
      const r = await api.listUsers();
      setMembers(r.data);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Team</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Who can access the registry. <strong>Admins</strong> can also approve imports and manage the team; <strong>staff
            editors</strong> maintain records and submit imports for approval.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add member
        </Button>
      </div>

      <Card>
        <CardHeader title={`Members (${members?.length ?? 0})`} subtitle="Disabled members keep their history and audit trail." />
        {!members ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-stone-100 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  <th className="px-5 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Last sign-in</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {members.map((m) => {
                  const isMe = m.id === me?.id;
                  return (
                    <tr key={m.id} className={m.disabled_at ? 'opacity-60' : ''}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-[12px] font-bold text-leaf-800 ring-1 ring-leaf-100">
                            {initials(m.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-medium text-ink">
                              {m.name} {isMe && <span className="text-[11px] font-normal text-ink-faint">(you)</span>}
                            </p>
                            <p className="truncate text-xs text-ink-soft">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          value={m.role}
                          disabled={isMe}
                          onChange={(e) => setMemberRole(m, e.target.value as 'admin' | 'editor')}
                          className="w-28"
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                        </Select>
                      </td>
                      <td className="px-3 py-3">
                        {m.disabled_at ? <Badge tone="rose">Disabled</Badge> : <Badge tone="green">Active</Badge>}
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-faint">
                        {m.last_login_at ? new Date(m.last_login_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="sm" title="Reset password" onClick={() => setResetTarget(m)}>
                            <KeyRound className="h-3.5 w-3.5" /> Reset
                          </Button>
                          {!isMe &&
                            (m.disabled_at ? (
                              <Button variant="outline" size="sm" onClick={() => setDisabled(m, false)}>
                                Enable
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => setDisabled(m, true)}>
                                Disable
                              </Button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-4.5 w-4.5 shrink-0 text-ink-faint" />
          <div className="text-[13px] leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">How import approval works</p>
            <p className="mt-1">
              Editors can upload workbooks and submit them for approval — the records stay untouched until an admin reviews the
              validation report and approves (or rejects with a reason) on the{' '}
              <a href="/import" className="font-medium text-leaf-700 underline-offset-2 hover:underline">
                Import page
              </a>
              . Admins can also apply their own imports immediately.
            </p>
          </div>
        </div>
      </Card>

      {/* Add member */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add team member">
        <div className="space-y-4">
          <Field label="Full name" error={fieldErrors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Obi" />
          </Field>
          <Field label="Work e-mail" error={fieldErrors.email}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@example.com" type="email" />
          </Field>
          <Field label="Role" hint="Editors submit imports for approval; admins approve and manage the team.">
            <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'editor')}>
              <option value="editor">Staff editor</option>
              <option value="admin">Administrator</option>
            </Select>
          </Field>
          <Field label="Temporary password" hint="They can change it in Settings after first sign-in.">
            <div className="flex gap-2">
              <Input value={password} readOnly className="font-mono text-[13px]" />
              <Button variant="outline" size="sm" onClick={regenerate} title="Generate a new password">
                <KeyRound className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Field>
          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addMember} loading={busy} disabled={!name.trim() || !email.trim()}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset confirm */}
      <ConfirmDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={doReset}
        title={`Reset password for ${resetTarget?.name}?`}
        message="They will be signed out on all devices and can sign in with the new temporary password. This action is logged."
        confirmLabel="Reset password"
        loading={busy}
      />

      {/* Temp password reveal (shown once) */}
      <Modal open={!!tempPw} onClose={() => setTempPw(null)} title="Temporary password">
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-inset ring-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Share this securely (it is not stored anywhere and cannot be shown again).</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-inset ring-stone-200">
            <code className="flex-1 select-all font-mono text-[15px] font-semibold tracking-wide text-ink">{tempPw}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(tempPw ?? '').catch(() => {});
                toast('success', 'Copied to clipboard.');
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setTempPw(null)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
