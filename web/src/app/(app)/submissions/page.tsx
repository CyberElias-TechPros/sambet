'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Banknote,
  Check,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Link2,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { BANKS, NIGERIAN_STATES } from '@/lib/constants';
import { displayPhone, formatDateTime, formatNaira, MATCH_LABELS, timeAgo } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import type { Submission, SubmissionDetail, SubmissionMatch, SubmissionSummary } from '@/lib/types';
import { Badge, Button, Card, Field, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlays';
import { Pagination } from '@/components/ui/pagination';

type Tab = 'pending' | 'verified' | 'rejected' | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const STATUS_TONE: Record<string, 'amber' | 'green' | 'rose' | 'stone'> = {
  pending: 'amber',
  verified: 'green',
  rejected: 'rose',
};

export default function SubmissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('pending');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [summary, setSummary] = useState<SubmissionSummary | null>(null);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listSubmissions(page, 20, tab === 'all' ? undefined : tab, q || undefined)
      .then((r) => {
        setRows(r.data);
        setSummary(r.summary);
        setMeta({ total: r.meta.total, pages: r.meta.pages });
      })
      .catch((e) => setError(e.message));
  }, [page, tab, q]);

  useEffect(load, [load]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => setPage(1), [tab, q]);

  const counts: Record<Tab, number | null> = summary
    ? {
        pending: summary.pending,
        verified: summary.verified,
        rejected: summary.rejected,
        all: summary.pending + summary.verified + summary.rejected,
      }
    : { pending: null, verified: null, rejected: null, all: null };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Public submissions</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Organizations that paid the fee and submitted their proof of payment. Verify the payment, then add them to
            the registry or link them to an existing record.
          </p>
        </div>
        <a
          href="/submit"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9.5 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-ink ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50"
        >
          <ExternalLink className="h-4 w-4" /> Open public portal
        </a>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3.5">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                  tab === t.id ? 'bg-bark-900 text-white shadow-sm' : 'text-ink-soft hover:bg-stone-100'
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                    tab === t.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-ink-soft'
                  }`}
                >
                  {counts[t.id] ?? '…'}
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reference, name, phone, account…"
              className="h-9 w-full rounded-lg border-0 bg-stone-50 pl-9 pr-3 text-[13px] text-ink ring-1 ring-inset ring-stone-200 placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-leaf-600"
            />
          </div>
        </div>

        {error && <p className="px-5 py-4 text-sm text-rose-600">{error}</p>}
        {!rows && !error && (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        )}

        {rows && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Inbox className="h-8 w-8 text-stone-300" />
            <p className="text-sm font-medium text-ink-soft">
              {q ? 'No submissions match your search.' : 'No submissions here yet.'}
            </p>
            <p className="max-w-xs text-xs text-ink-faint">
              Share the public portal link so organizations can submit their payment and details.
            </p>
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-stone-100 text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Reference</th>
                  <th className="px-3 py-2.5 font-medium">Organization</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium">State</th>
                  <th className="px-3 py-2.5 font-medium">Bank</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Submitted</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-stone-50 transition hover:bg-stone-50/60">
                    <td className="px-5 py-3 font-mono text-[12.5px] text-ink">{s.reference}</td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-[13px] font-medium text-ink">{s.org_name}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] text-ink-soft">{displayPhone(s.phone)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] text-ink-soft">{s.state ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] text-ink-soft">{s.bank}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-leaf-800">
                      {formatNaira(s.amount_paid)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-ink-faint" title={formatDateTime(s.created_at)}>
                      {timeAgo(s.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={STATUS_TONE[s.status] ?? 'stone'}>
                        {s.status === 'pending' ? 'Pending' : s.status === 'verified' ? 'Verified' : 'Rejected'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(s.id)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows && rows.length > 0 && (
          <Pagination page={page} pages={meta.pages} total={meta.total} pageSize={20} onPage={setPage} />
        )}
      </Card>

      <ReviewDialog id={openId} onClose={() => setOpenId(null)} onReviewed={load} isAdmin={isAdmin} />
    </div>
  );
}

/* ---------------- review dialog ---------------- */

function ReviewDialog({
  id,
  onClose,
  onReviewed,
  isAdmin,
}: {
  id: number | null;
  onClose: () => void;
  onReviewed: () => void;
  isAdmin: boolean;
}) {
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'none' | 'create' | 'link' | 'reject'>('none');
  const [busy, setBusy] = useState(false);

  // create-form state (prefilled from the submission)
  const [fName, setFName] = useState('');
  const [fCeo, setFCeo] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fState, setFState] = useState('');
  const [fBank, setFBank] = useState('');
  const [fAccount, setFAccount] = useState('');
  const [fLga, setFLga] = useState('');
  const [fProject, setFProject] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [linkId, setLinkId] = useState<number | ''>('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (id == null) {
      setSub(null);
      return;
    }
    setLoading(true);
    setError(null);
    setAction('none');
    setReason('');
    setLinkId('');
    api
      .getSubmission(id)
      .then((r) => {
        const d = r.data;
        setSub(d);
        setFName(d.org_name);
        setFCeo(d.account_name ?? '');
        setFPhone(d.phone);
        setFState(d.state ?? '');
        setFBank(d.bank);
        setFAccount(d.account_number);
        setFNotes(d.notes ?? '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function doVerify() {
    if (!sub) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'create') {
        await api.verifySubmission(sub.id, {
          action: 'create',
          org: {
            name: fName,
            ceo_name: fCeo || null,
            phone: fPhone || null,
            state: fState || null,
            bank: fBank || null,
            account_number: fAccount || null,
            lga: fLga || null,
            project_type: fProject || null,
            notes: [fNotes, 'Verified from public submission ' + sub.reference].filter(Boolean).join(' · '),
          },
        });
      } else if (action === 'link') {
        if (!linkId) throw new ApiError(400, 'Choose the organization to link');
        await api.verifySubmission(sub.id, { action: 'link', orgId: Number(linkId) });
      } else if (action === 'reject') {
        await api.rejectSubmission(sub.id, reason);
      } else {
        return;
      }
      onReviewed();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(e.message + ' Use “Link to existing” below instead.');
        setAction('link');
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  }

  if (id == null) return null;

  const rows: [string, React.ReactNode][] = sub
    ? [
        ['Organization', sub.org_name],
        ['Phone', displayPhone(sub.phone)],
        ['State', sub.state ?? '—'],
        ['Bank (paid from)', sub.bank],
        ['Account number', sub.account_number],
        ['Account name', sub.account_name ?? '—'],
        ['Amount paid', <span key="amount" className="font-semibold text-leaf-800">{formatNaira(sub.amount_paid)}</span>],
        ['Payment date', sub.payment_date ?? '—'],
        ['Transfer reference', sub.payment_reference ?? '—'],
      ]
    : [];

  return (
    <Modal open onClose={onClose} title={sub ? `Review — ${sub.reference}` : 'Review submission'} wide>
      {loading && <Skeleton className="h-64" />}
      {error && !loading && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] font-medium text-rose-700">{error}</p>
      )}
      {sub && !loading && (
        <div className="grid gap-5 md:grid-cols-2">
          {/* left: submitted details */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Submitted details</p>
            <dl className="space-y-2 rounded-xl bg-stone-50 p-4">
              {rows.map(([k, v]) => (
                <div key={k as string} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <dt className="shrink-0 text-ink-faint">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {sub.notes && (
              <div className="mt-3 rounded-xl border border-stone-200 p-3 text-[13px] leading-relaxed text-ink-soft">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Message</p>
                {sub.notes}
              </div>
            )}

            {sub.status === 'verified' && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-leaf-50 p-3 text-[13px] text-leaf-800 ring-1 ring-inset ring-leaf-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Verified by {sub.reviewer ?? 'an admin'} on{' '}
                {formatDateTime(sub.reviewed_at)}
                {sub.org_id ? ` · linked to org #${sub.org_id}` : ''}
              </p>
            )}
            {sub.status === 'rejected' && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Rejected by {sub.reviewer ?? 'an admin'} on {formatDateTime(sub.reviewed_at)}
                  {sub.rejection_reason ? ` — “${sub.rejection_reason}”` : ''}
                </span>
              </p>
            )}
          </div>

          {/* right: POP + matches */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Proof of payment</p>
            {sub.pop_url ? (
              <a href={sub.pop_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-inset ring-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sub.pop_url} alt={`Proof of payment for ${sub.reference}`} className="max-h-52 w-full bg-stone-100 object-contain" />
              </a>
            ) : (
              <p className="rounded-xl bg-stone-50 p-4 text-[13px] text-ink-faint">Image no longer available.</p>
            )}

            {sub.matches && sub.matches.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-900">
                  <ShieldAlert className="h-4 w-4" /> Possible match in the registry
                </p>
                <ul className="mt-2 space-y-1.5">
                  {sub.matches.map((m: SubmissionMatch) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-amber-900">
                      <span className="font-medium">#{m.id} · {m.name}</span>
                      <span className="text-amber-700/70">{m.state_norm ?? '—'}</span>
                      <Badge tone="amber">{MATCH_LABELS[m.match] ?? m.match}</Badge>
                      {action === 'link' && (
                        <button
                          onClick={() => setLinkId(m.id)}
                          className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset transition ${
                            linkId === m.id ? 'bg-amber-600 text-white ring-amber-600' : 'bg-white text-amber-800 ring-amber-300 hover:bg-amber-100'
                          }`}
                        >
                          {linkId === m.id ? 'Selected' : 'Link to this'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* actions */}
      {sub && !loading && sub.status === 'pending' && (
        <div className="mt-5 border-t border-stone-100 pt-4">
          {!isAdmin ? (
            <p className="rounded-xl bg-stone-50 p-3 text-[13px] text-ink-soft">
              Only admins can verify or reject submissions. You can review the details here.
            </p>
          ) : action === 'none' ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setAction('create')}>
                <Check className="h-4 w-4" /> Verify — add to registry
              </Button>
              <Button variant="outline" onClick={() => setAction('link')}>
                <Link2 className="h-4 w-4" /> Verify — link to existing
              </Button>
              <Button variant="danger" className="ml-auto" onClick={() => setAction('reject')}>
                <X className="h-4 w-4" /> Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {action === 'create' && (
                <div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
                  <Field label="Organization name" required className="sm:col-span-2">
                    <Input value={fName} onChange={(e) => setFName(e.target.value)} />
                  </Field>
                  <Field label="Contact person">
                    <Input value={fCeo} onChange={(e) => setFCeo(e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <Input value={fPhone} onChange={(e) => setFPhone(e.target.value)} />
                  </Field>
                  <Field label="State">
                    <Select value={fState} onChange={(e) => setFState(e.target.value)}>
                      <option value="">—</option>
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Bank">
                    <Select value={fBank} onChange={(e) => setFBank(e.target.value)}>
                      <option value="">—</option>
                      {BANKS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Account number">
                    <Input value={fAccount} onChange={(e) => setFAccount(e.target.value)} />
                  </Field>
                  <Field label="Local government">
                    <Input value={fLga} onChange={(e) => setFLga(e.target.value)} />
                  </Field>
                  <Field label="Project type" className="sm:col-span-2">
                    <Input value={fProject} onChange={(e) => setFProject(e.target.value)} placeholder="e.g. Borehole / road / clinic" />
                  </Field>
                </div>
              )}

              {action === 'link' && (
                <div className="rounded-xl bg-stone-50 p-4">
                  <p className="text-[13px] leading-relaxed text-ink-soft">
                    The organization is already in the registry. Pick the record to attach this payment to
                    {sub.matches?.length ? ' — suggested matches are above' : ''}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sub.matches?.map((m: SubmissionMatch) => (
                      <button
                        key={m.id}
                        onClick={() => setLinkId(m.id)}
                        className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition ${
                          linkId === m.id ? 'bg-bark-900 text-white ring-bark-900' : 'bg-white text-ink ring-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        #{m.id} · {m.name}
                      </button>
                    ))}
                  </div>
                  <Field label="…or enter an organization ID" className="mt-3">
                    <Input
                      value={linkId}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setLinkId(digits ? Number(digits) : '');
                      }}
                      placeholder="e.g. 482"
                      inputMode="numeric"
                    />
                  </Field>
                </div>
              )}

              {action === 'reject' && (
                <div className="rounded-xl bg-stone-50 p-4">
                  <Field label="Reason (shared with the submitter)" required>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Payment amount does not match, or transfer not found in bank records" />
                  </Field>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={doVerify} loading={busy}>
                  {action === 'create' ? (
                    <>
                      <Check className="h-4 w-4" /> Add to registry
                    </>
                  ) : action === 'link' ? (
                    <>
                      <Link2 className="h-4 w-4" /> Confirm link
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" /> Confirm rejection
                    </>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setAction('none')}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {sub && sub.status !== 'pending' && (
        <div className="mt-5 flex justify-end border-t border-stone-100 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      )}

      {sub && sub.status === 'pending' && !loading && (
        <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
          <Banknote className="h-3.5 w-3.5" /> {formatNaira(sub.amount_paid)} claimed · submitted {timeAgo(sub.created_at)}
        </p>
      )}
    </Modal>
  );
}
