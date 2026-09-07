'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Sprout,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { PublicStatus } from '@/lib/types';

/** Visual journey for a submission — where it stands in verification. */
function VerificationTimeline({ status }: { status: PublicStatus['status'] }) {
  const steps = [
    { label: 'Submitted', desc: 'Your details and proof of payment were received' },
    { label: 'Payment verified', desc: 'Our team confirms your transfer' },
    { label: 'Registered', desc: 'Your organization joins the registry' },
  ];
  const stepState = (i: number): 'done' | 'active' | 'failed' | 'todo' => {
    if (status === 'verified') return 'done';
    if (status === 'rejected') return i === 0 ? 'done' : i === 1 ? 'failed' : 'todo';
    return i === 0 ? 'done' : i === 1 ? 'active' : 'todo';
  };
  const chips: Record<'done' | 'active' | 'failed' | 'todo', string> = {
    done: 'bg-leaf-50 text-leaf-600 ring-leaf-200',
    active: 'bg-amber-50 text-amber-600 ring-amber-200',
    failed: 'bg-rose-50 text-rose-600 ring-rose-200',
    todo: 'bg-stone-100 text-stone-400 ring-stone-200',
  };
  return (
    <ol className="mt-7 grid gap-4 border-t border-stone-100 pt-6 sm:grid-cols-3 sm:gap-3">
      {steps.map((s, i) => {
        const st = stepState(i);
        return (
          <li key={s.label} className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${chips[st]}`}>
              {st === 'done' && <CheckCircle2 className="h-4.5 w-4.5" />}
              {st === 'active' && <Clock className="h-4.5 w-4.5 animate-pulse" />}
              {st === 'failed' && <XCircle className="h-4.5 w-4.5" />}
              {st === 'todo' && <span className="text-[12px] font-bold">{i + 1}</span>}
            </span>
            <span>
              <span className={`block text-[13px] font-semibold ${st === 'todo' ? 'text-ink-faint' : 'text-ink'}`}>
                {s.label}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-faint">{s.desc}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function TrackPage() {
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const ref = reference.trim().toUpperCase();
    if (!ref) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const r = await api.publicStatus(ref);
      setStatus(r.data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href="/track" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-leaf-400 to-leaf-700">
              <Sprout className="h-4.5 w-4.5 text-white" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">Sambet</span>
              <span className="block text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Track a submission
              </span>
            </span>
          </Link>
          <Link href="/submit" className="text-[12.5px] font-medium text-ink-soft transition hover:text-ink">
            New submission →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Track your submission</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Enter the reference you received (e.g. SAM-2026-00001) to see where your application stands.
        </p>

        <form onSubmit={lookup} className="mt-5 flex gap-2">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value.toUpperCase())}
            placeholder="SAM-2026-00001"
            maxLength={20}
            className="h-12 flex-1 rounded-xl border-0 bg-white px-4 font-mono text-[15px] uppercase tracking-wider text-ink shadow-sm ring-1 ring-inset ring-stone-300 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-leaf-600"
          />
          <button
            type="submit"
            disabled={loading || !reference.trim()}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-leaf-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-800 disabled:bg-stone-300"
          >
            {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Search className="h-4.5 w-4.5" />}
            Check
          </button>
        </form>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4.5 w-4.5" /> {error}
            </p>
          </div>
        )}

        {status && (
          <div className="mt-5 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-card">
            {status.status === 'pending' && (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-inset ring-amber-200">
                  <Clock className="h-6 w-6 text-amber-600" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-ink">Under review</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  Your submission <span className="font-mono font-semibold text-ink">{status.reference}</span> was
                  received on {formatDateTime(status.created_at)}. Our team is verifying your payment and proof of
                  payment. This usually takes 1–3 days.
                </p>
              </>
            )}
            {status.status === 'verified' && (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-leaf-50 ring-1 ring-inset ring-leaf-200">
                  <CheckCircle2 className="h-6 w-6 text-leaf-600" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-ink">Verified — you are in the registry</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  Your payment was verified
                  {status.org_name ? (
                    <>
                      {' '}
                      and <span className="font-semibold text-ink">{status.org_name}</span> has been added to the
                      registry.
                    </>
                  ) : (
                    '.'
                  )}{' '}
                  Thank you for participating in the Grassroots Project.
                </p>
              </>
            )}
            {status.status === 'rejected' && (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 ring-1 ring-inset ring-rose-200">
                  <XCircle className="h-6 w-6 text-rose-600" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-ink">Not verified</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  We could not verify this submission.
                  {status.reason ? (
                    <span className="mt-1.5 block rounded-xl bg-stone-50 p-3 text-[13px] text-ink">
                      <span className="font-semibold">Reason: </span>
                      {status.reason}
                    </span>
                  ) : null}{' '}
                  If you believe this is a mistake, contact the project team with your reference{' '}
                  <span className="font-mono font-semibold text-ink">{status.reference}</span> and your proof of
                  payment.
                </p>
              </>
            )}
            <VerificationTimeline status={status.status} />
          </div>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-faint">
          <BadgeCheck className="h-3.5 w-3.5" /> Sambet Grassroots Project
        </p>
      </main>
    </div>
  );
}
