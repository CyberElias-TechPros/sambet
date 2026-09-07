'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Copy,
  ImagePlus,
  Loader2,
  Lock,
  Send,
  Sprout,
  Wallet,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { BANKS, FEE_OPTIONS, NIGERIAN_STATES, PUBLIC_TRANSFER } from '@/lib/constants';
import { formatNaira } from '@/lib/format';
import type { PublicSubmitResult } from '@/lib/types';

const FEE_PRESETS = FEE_OPTIONS.map((f) => f.value);

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PublicSubmitPage() {
  const [orgName, setOrgName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('1000');
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [popFile, setPopFile] = useState<File | null>(null);
  const [popPreview, setPopPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PublicSubmitResult | null>(null);
  const [copied, setCopied] = useState(false);

  function onPopChange(f: File | null) {
    if (popPreview) URL.revokeObjectURL(popPreview);
    setPopPreview(f ? URL.createObjectURL(f) : null);
    setPopFile(f);
    if (f) setFieldErrors((e) => ({ ...e, pop: '' }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const local: Record<string, string> = {};
    if (orgName.trim().length < 2) local.org_name = 'Please enter your organization name';
    if (!/^[0-9Oo+\s-]{9,17}$/.test(phone.trim())) local.phone = 'Enter a valid phone number (e.g. 0803 123 4567)';
    if (!state) local.state = 'Choose your state';
    if (!bank) local.bank = 'Choose the bank you paid from';
    if (!/^\d{8,12}$/.test(accountNumber.replace(/\D/g, ''))) local.account_number = 'Enter the 8–12 digit account number you paid from';
    if (!/^\d+$/.test(amount.trim())) local.amount_paid = 'Enter the amount you paid';
    if (!popFile) local.pop = 'Upload a picture of your proof of payment';
    if (Object.values(local).some(Boolean)) {
      setFieldErrors(local);
      return;
    }

    const fd = new FormData();
    fd.append('org_name', orgName.trim());
    fd.append('phone', phone.trim());
    fd.append('state', state);
    fd.append('bank', bank);
    fd.append('account_number', accountNumber.replace(/\D/g, ''));
    if (accountName.trim()) fd.append('account_name', accountName.trim());
    fd.append('amount_paid', amount.trim());
    if (paymentDate) fd.append('payment_date', paymentDate);
    if (paymentRef.trim()) fd.append('payment_reference', paymentRef.trim());
    if (notes.trim()) fd.append('notes', notes.trim());
    fd.append('pop', popFile!);
    // Honeypot — humans never see this field.
    fd.append('website', '');

    setSubmitting(true);
    try {
      const r = await api.publicSubmit(fd);
      setResult(r.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError('Something went wrong. Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function copyRef() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  /* ---------------- success screen ---------------- */
  if (result) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl border border-stone-200/80 bg-white p-8 text-center shadow-card">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf-50 ring-1 ring-inset ring-leaf-200">
              <CheckCircle2 className="h-8 w-8 text-leaf-600" />
            </span>
            <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
              Submission received
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Your organization has been submitted for verification. Keep this reference — you can use it to track your
              application.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2">
              <span className="rounded-xl bg-bark-900 px-5 py-3 font-mono text-lg font-semibold tracking-wider text-white">
                {result.reference}
              </span>
              <button
                onClick={copyRef}
                className="rounded-xl p-3 text-ink-soft ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50"
                title="Copy reference"
              >
                {copied ? <CheckCircle2 className="h-5 w-5 text-leaf-600" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>

            {result.matches.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-[13px] leading-relaxed text-amber-900">
                <p className="font-semibold">Heads up — a possible match</p>
                <p className="mt-1">
                  An organization with the same {result.matches.map((m) => (m.match === 'phone' ? 'phone number' : m.match === 'account' ? 'bank account' : 'name and state')).join(' / ')} is
                  already in the registry ({result.matches[0]?.name}). Our team will check this carefully so you are not
                  registered twice.
                </p>
              </div>
            )}

            <div className="mt-6 space-y-3 rounded-xl bg-stone-50 p-5 text-left">
              <p className="text-[13px] font-semibold text-ink">What happens next</p>
              {[
                'Our team verifies your payment against the proof you uploaded (usually within 1–3 days).',
                'If everything matches, your organization is added to the registry.',
                'Track any time with your reference — no login needed.',
              ].map((t, i) => (
                <p key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-soft">
                  <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-[10px] font-bold text-leaf-800">
                    {i + 1}
                  </span>
                  {t}
                </p>
              ))}
            </div>

            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/track"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-leaf-700 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-leaf-800"
              >
                Track my submission <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="javascript:void(0)"
                onClick={() => {
                  setResult(null);
                  setOrgName('');
                  setPhone('');
                  setState('');
                  setBank('');
                  setAccountNumber('');
                  setAccountName('');
                  setAmount('1000');
                  setPaymentRef('');
                  setNotes('');
                  onPopChange(null);
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-medium text-ink-soft ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50"
              >
                Submit another
              </a>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------------- form ---------------- */
  const inputCls = (bad?: string) =>
    `w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-[15px] text-ink shadow-sm ring-1 ring-inset placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-inset transition ${
      bad ? 'ring-rose-300 focus:ring-rose-500' : 'ring-stone-300 focus:ring-leaf-600'
    }`;
  const labelCls = 'mb-1.5 block text-[13px] font-medium text-ink';

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
          Register your organization
        </h1>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-soft">
          Pay the registration fee by bank transfer, then fill in the form and upload a picture of your proof of
          payment. Our team verifies it and adds your organization to the registry.
        </p>

        {/* steps */}
        <ol className="mt-6 grid gap-2 sm:grid-cols-3">
          {[
            { n: 1, t: 'Make the transfer', d: 'Pay the fee to the account below' },
            { n: 2, t: 'Fill the form', d: 'Your organization details + proof of payment' },
            { n: 3, t: 'We verify', d: 'You get a reference to track your submission' },
          ].map((s) => (
            <li key={s.n} className="flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-card">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-[13px] font-bold text-white">
                {s.n}
              </span>
              <span>
                <span className="block text-[13.5px] font-semibold text-ink">{s.t}</span>
                <span className="block text-xs text-ink-faint">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>

        {/* transfer details */}
        <div className="mt-4 rounded-2xl border border-leaf-200 bg-leaf-50/60 p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4.5 w-4.5 text-leaf-700" />
            <p className="text-[14px] font-semibold text-leaf-900">Registration fee</p>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-leaf-900/80">
            Transfer the fee to the account below, then upload a clear picture of the transfer receipt (proof of
            payment).
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {FEE_OPTIONS.map((f) => (
              <div key={f.value} className="rounded-xl bg-white/80 p-3 ring-1 ring-inset ring-leaf-200/70">
                <p className="text-[15px] font-bold text-leaf-900">{f.label}</p>
                <p className="text-xs text-leaf-800/70">{f.hint}</p>
              </div>
            ))}
          </div>
          {PUBLIC_TRANSFER.accountNumber ? (
            <dl className="mt-4 grid gap-3 rounded-xl bg-white p-4 text-[14px] ring-1 ring-inset ring-leaf-200 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Bank</dt>
                <dd className="mt-0.5 font-semibold text-ink">{PUBLIC_TRANSFER.bank || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Account name</dt>
                <dd className="mt-0.5 font-semibold text-ink">{PUBLIC_TRANSFER.accountName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Account number</dt>
                <dd className="mt-0.5 font-mono text-[15px] font-bold tracking-wider text-leaf-900">
                  {PUBLIC_TRANSFER.accountNumber}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] font-medium text-amber-900">
              <Banknote className="mr-1.5 inline h-4 w-4" />
              Payment details are being finalised. If you already have the account details, go ahead and make the
              transfer, then submit your proof of payment below.
            </p>
          )}
        </div>

        {/* form */}
        <form onSubmit={submit} className="mt-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-card sm:p-6">
          {error && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] font-medium text-rose-700">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="org_name">
                Organization name <span className="text-rose-500">*</span>
              </label>
              <input id="org_name" className={inputCls(fieldErrors.org_name)} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Imuetinyan Emokpae Community Association" maxLength={200} />
              {fieldErrors.org_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.org_name}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="phone">
                Phone number <span className="text-rose-500">*</span>
              </label>
              <input id="phone" className={inputCls(fieldErrors.phone)} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" inputMode="tel" maxLength={20} />
              {fieldErrors.phone && <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="state">
                State <span className="text-rose-500">*</span>
              </label>
              <select id="state" className={inputCls(fieldErrors.state)} value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Choose state…</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {fieldErrors.state && <p className="mt-1 text-xs text-rose-600">{fieldErrors.state}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="bank">
                Bank you paid from <span className="text-rose-500">*</span>
              </label>
              <select id="bank" className={inputCls(fieldErrors.bank)} value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">Choose bank…</option>
                {BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {fieldErrors.bank && <p className="mt-1 text-xs text-rose-600">{fieldErrors.bank}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="account_number">
                Account number (yours) <span className="text-rose-500">*</span>
              </label>
              <input id="account_number" className={inputCls(fieldErrors.account_number)} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="The account you transferred from" inputMode="numeric" maxLength={12} />
              {fieldErrors.account_number && <p className="mt-1 text-xs text-rose-600">{fieldErrors.account_number}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="account_name">
                Account name <span className="text-xs font-normal text-ink-faint">(optional)</span>
              </label>
              <input id="account_name" className={inputCls()} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Name on the account" maxLength={200} />
            </div>

            <div>
              <label className={labelCls} htmlFor="payment_date">
                Date of payment <span className="text-xs font-normal text-ink-faint">(optional)</span>
              </label>
              <input id="payment_date" type="date" className={inputCls(fieldErrors.payment_date)} value={paymentDate} max={today()} onChange={(e) => setPaymentDate(e.target.value)} />
              {fieldErrors.payment_date && <p className="mt-1 text-xs text-rose-600">{fieldErrors.payment_date}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="amount">
                Amount paid (₦) <span className="text-rose-500">*</span>
              </label>
              <input id="amount" className={inputCls(fieldErrors.amount_paid)} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" inputMode="numeric" />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {FEE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(p))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${
                      amount === String(p) ? 'bg-leaf-700 text-white ring-leaf-700' : 'bg-white text-leaf-800 ring-leaf-200 hover:bg-leaf-50'
                    }`}
                  >
                    {formatNaira(p)}
                  </button>
                ))}
              </div>
              {fieldErrors.amount_paid && <p className="mt-1 text-xs text-rose-600">{fieldErrors.amount_paid}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="payment_ref">
                Transfer reference <span className="text-xs font-normal text-ink-faint">(optional)</span>
              </label>
              <input id="payment_ref" className={inputCls()} value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Teller / transaction ref" maxLength={100} />
            </div>

            <div>
              <label className={labelCls} htmlFor="notes">
                Message <span className="text-xs font-normal text-ink-faint">(optional)</span>
              </label>
              <input id="notes" className={inputCls()} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you want us to know" maxLength={2000} />
            </div>

            <div className="sm:col-span-2">
              <span className={labelCls}>
                Proof of payment <span className="text-rose-500">*</span>
                <span className="ml-auto text-xs font-normal text-ink-faint">JPG, PNG or WebP · max 6 MB</span>
              </span>
              {popPreview ? (
                <div className="relative overflow-hidden rounded-xl ring-1 ring-inset ring-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={popPreview} alt="Proof of payment preview" className="max-h-56 w-full bg-stone-100 object-contain" />
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onPopChange(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="rounded-lg bg-stone-900/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-stone-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition ${
                    fieldErrors.pop ? 'border-rose-300 bg-rose-50/40' : 'border-stone-300 bg-stone-50 hover:border-leaf-400 hover:bg-leaf-50/40'
                  }`}
                >
                  <ImagePlus className={`h-7 w-7 ${fieldErrors.pop ? 'text-rose-400' : 'text-leaf-600'}`} />
                  <span className="text-[13.5px] font-medium text-ink">Tap to upload the picture of your proof of payment</span>
                  <span className="text-xs text-ink-faint">A clear photo of the transfer receipt or bank app screenshot</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 6 * 1024 * 1024) {
                    setFieldErrors((prev) => ({ ...prev, pop: 'The image is too large (max 6 MB)' }));
                    return;
                  }
                  onPopChange(f);
                }}
              />
              {fieldErrors.pop && <p className="mt-1 text-xs text-rose-600">{fieldErrors.pop}</p>}
            </div>

            {/* honeypot */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" tabIndex={-1} autoComplete="off" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-leaf-700 text-[15px] font-semibold text-white shadow-sm transition hover:bg-leaf-800 disabled:bg-stone-300"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" /> Your details are only used to verify your payment and register your
            organization.
          </p>
        </form>

        <p className="mt-5 text-center text-[13px] text-ink-soft">
          Already submitted before?{' '}
          <Link href="/track" className="font-semibold text-leaf-700 underline-offset-2 hover:underline">
            Track your submission
          </Link>
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/submit" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-leaf-400 to-leaf-700">
              <Sprout className="h-4.5 w-4.5 text-white" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">Sambet</span>
              <span className="block text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Grassroots Project
              </span>
            </span>
          </Link>
          <Link href="/login" className="text-[12.5px] font-medium text-ink-soft transition hover:text-ink">
            Staff sign-in →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 pb-10">
        <div className="flex items-center justify-center gap-2 text-[11.5px] text-ink-faint">
          <BadgeCheck className="h-3.5 w-3.5" /> Sambet Grassroots Project · member organization registry
        </div>
      </footer>
    </div>
  );
}
