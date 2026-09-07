'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Organization, OrgInput } from '@/lib/types';
import { BANKS, NIGERIAN_STATES, PROJECT_CATEGORIES, STATUS_OPTIONS } from '@/lib/constants';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/hooks/use-toast';

function toForm(o?: Organization | null) {
  return {
    sn: o?.sn != null ? String(o.sn) : '',
    name: o?.name ?? '',
    ceo_name: o?.ceo_name ?? '',
    phone: o?.phone ?? '',
    email: o?.email ?? '',
    bank: o?.bank ?? '',
    account_number: o?.account_number ?? '',
    lga: o?.lga ?? '',
    state: o?.state ?? '',
    project_type: o?.project_type ?? '',
    status: o?.status ?? 'registered',
    notes: o?.notes ?? '',
    cycle: o?.cycle ?? 'Project 1',
  };
}

type FormState = ReturnType<typeof toForm>;

export function OrgForm({
  org,
  onSaved,
  onCancel,
}: {
  org?: Organization | null;
  onSaved: (o: Organization) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => toForm(org));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => setForm(toForm(org)), [org]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Client-side hints for the category (server does the real classification).
  const categoryHint = (() => {
    const t = form.project_type.toLowerCase();
    if (!t.trim()) return null;
    const rules: [RegExp, string][] = [
      [/road|drainage|bridge|infrastructure/, 'Roads & Infrastructure'],
      [/borehole|bore|water|sanitation|pipeline/, 'Water & Sanitation'],
      [/solar|electric|power|light|grid/, 'Energy & Lighting'],
      [/school|classroom|education|university|college|academy|library/, 'Education'],
      [/hospital|health|clinic|medical|drug|pharmacy/, 'Health'],
      [/housing|estate|real estate|building|residential|apartment/, 'Housing & Real Estate'],
      [/farm|agro|poultry|cassava|rice|fish|animal|livestock|vegetable|food|crop/, 'Agriculture & Food'],
      [/mall|market|shop|store|industry|processing|factory|trade|commerce/, 'Commerce & Industry'],
      [/ict|computer|technology|digital|telecom|internet/, 'ICT & Technology'],
      [/police|security|cctv|civil defence/, 'Security & Defence'],
      [/environment|cleanup|waste/, 'Environment & Cleanup'],
      [/church|ministry|mosque|temple|faith|welfare|orphanage|humanitarian/, 'Faith & Social'],
    ];
    let best: { pos: number; label: string } | null = null;
    for (const [re, label] of rules) {
      const m = t.match(re);
      if (m && m.index !== undefined && (!best || m.index < best.pos)) best = { pos: m.index, label };
    }
    return best ? best.label : 'Other';
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const payload: OrgInput = {
      sn: form.sn ? parseInt(form.sn, 10) || null : null,
      name: form.name.trim(),
      ceo_name: form.ceo_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      bank: form.bank.trim() || null,
      account_number: form.account_number.trim() || null,
      lga: form.lga.trim() || null,
      state: form.state.trim() || null,
      project_type: form.project_type.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      cycle: form.cycle.trim() || 'Project 1',
    };
    setBusy(true);
    try {
      if (org) {
        const { data } = await api.updateOrg(org.id, payload);
        toast('success', 'Organization updated.');
        onSaved({ ...org, ...data } as Organization);
      } else {
        const { data } = await api.createOrg(payload);
        toast('success', 'Organization added.');
        onSaved(data as Organization);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Identity</h3>
        <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
          <Field label="Organization name" required error={fieldErrors.name}>
            <Input value={form.name} onChange={set('name')} placeholder="e.g. Embrace Multipurpose Cooperative" required maxLength={200} />
          </Field>
          <Field label="S/N" hint="optional" error={fieldErrors.sn}>
            <Input value={form.sn} onChange={set('sn')} inputMode="numeric" placeholder="e.g. 2001" />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project cycle" hint="e.g. Project 1">
            <Input value={form.cycle} onChange={set('cycle')} maxLength={80} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name of CEO / representative" error={fieldErrors.ceo_name}>
            <Input value={form.ceo_name} onChange={set('ceo_name')} placeholder="Full name" maxLength={200} />
          </Field>
          <Field label="Phone" error={fieldErrors.phone} hint="e.g. 0803 123 4567">
            <Input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="0803…" maxLength={32} />
          </Field>
          <Field label="E-mail" error={fieldErrors.email} className="sm:col-span-2">
            <Input type="email" value={form.email} onChange={set('email')} placeholder="name@organization.org" maxLength={160} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Location</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State" error={fieldErrors.state}>
            <Input value={form.state} onChange={set('state')} placeholder="e.g. Lagos" list="states-list" maxLength={200} />
            <datalist id="states-list">
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Local government (LGA)" error={fieldErrors.lga}>
            <Input value={form.lga} onChange={set('lga')} placeholder="e.g. Mushin" maxLength={200} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Bank details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank" error={fieldErrors.bank}>
            <Input value={form.bank} onChange={set('bank')} placeholder="e.g. Zenith Bank" list="banks-list" maxLength={120} />
            <datalist id="banks-list">
              {BANKS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
          <Field label="Account number" error={fieldErrors.account_number} hint="6–12 digits">
            <Input value={form.account_number} onChange={set('account_number')} inputMode="numeric" placeholder="1012345678" maxLength={32} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Project</h3>
        <Field
          label="Project type / description"
          error={fieldErrors.project_type}
          hint={categoryHint ? `→ classified as “${categoryHint}”` : undefined}
        >
          <Input
            value={form.project_type}
            onChange={set('project_type')}
            placeholder="e.g. Road construction and solar street lights"
            list="projects-list"
            maxLength={400}
          />
          <datalist id="projects-list">
            {PROJECT_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Notes" className="mt-4" error={fieldErrors.notes}>
          <Textarea value={form.notes} onChange={set('notes')} placeholder="Anything the team should know…" maxLength={2000} />
        </Field>
      </section>

      {error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">{error}</div>
      )}

      <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {org ? 'Save changes' : 'Add organization'}
        </Button>
      </div>
    </form>
  );
}
