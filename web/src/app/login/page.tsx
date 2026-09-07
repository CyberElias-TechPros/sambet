'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sprout, Building2, Upload, ShieldCheck, ArrowRight, LockKeyhole, Send } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button, Field, Input } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';

function BrandPanel() {
  return (
    <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-bark-800 via-bark-900 to-bark-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #4FAB84 0, transparent 32%), radial-gradient(circle at 82% 12%, #2E8C65 0, transparent 30%), radial-gradient(circle at 70% 85%, #1F7350 0, transparent 38%)',
        }}
      />
      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf-400 to-leaf-700 ring-1 ring-white/20">
          <Sprout className="h-6 w-6 text-white" />
        </span>
        <div>
          <p className="font-display text-2xl font-semibold tracking-tight text-white">Sambet</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-leaf-300/80">Grassroots Project Registry</p>
        </div>
      </div>

      <div className="relative">
        <h1 className="font-display text-[40px] font-semibold leading-[1.15] tracking-tight text-white">
          Every member organization,
          <br />
          <span className="text-leaf-300">one clean registry.</span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-leaf-100/60">
          Replace the spreadsheet with a system that keeps the Grassroots Project registry searchable, complete and always exportable.
        </p>
        <ul className="mt-8 space-y-4">
          {[
            { icon: Building2, title: 'Full member registry', text: '2,000+ organizations with contacts, banks, locations and project types.' },
            { icon: Send, title: 'Public registration', text: 'Organizations pay their fee, upload proof of payment, and you verify before they join.' },
            { icon: Upload, title: 'Excel import & export', text: 'Upload workbooks, review a validation report, import in one click — export anytime.' },
            { icon: ShieldCheck, title: 'Private & audited', text: 'Staff-only access with sessions, rate limiting and a full audit trail.' },
          ].map((f) => (
            <li key={f.title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <f.icon className="h-4.5 w-4.5 text-leaf-300" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{f.title}</span>
                <span className="block text-[13px] leading-relaxed text-leaf-100/50">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-leaf-100/40">SAMBET Grassroot Project · UAAG VIP Members registry</p>
    </div>
  );
}

export default function LoginPage() {
  const { user, loading, initialized, login, setup } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'setup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && initialized === false) setMode('setup');
  }, [loading, initialized]);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (mode === 'setup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'setup') {
        await setup(name.trim(), email.trim(), password);
        toast('success', 'Account created — welcome to Sambet.');
      } else {
        await login(email.trim(), password);
        toast('success', 'Signed in.');
      }
      router.replace('/dashboard');
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-leaf-200 border-t-leaf-600" />
      </div>
    );
  }

  const isSetup = mode === 'setup';

  return (
    <div className="flex min-h-screen bg-paper">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-leaf-400 to-leaf-700">
              <Sprout className="h-5.5 w-5.5 text-white" />
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-ink">Sambet</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">Grassroots Project Registry</p>
            </div>
          </div>

          <h2 className="font-display text-[28px] font-semibold tracking-tight text-ink">
            {isSetup ? 'Create the admin account' : 'Welcome back'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {isSetup
              ? 'This system has not been set up yet. The first account becomes the administrator.'
              : 'Sign in to manage the member registry.'}
          </p>

          {initialized !== false && (
            <div className="mt-4 inline-flex rounded-lg bg-stone-100 p-0.5 ring-1 ring-inset ring-stone-200">
              {(['signin', 'setup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setFieldErrors({});
                  }}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                    mode === m ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {m === 'signin' ? 'Sign in' : 'Set up'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {isSetup && (
              <Field label="Full name" required error={fieldErrors.name}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Obi" required minLength={2} autoComplete="name" />
              </Field>
            )}
            <Field label="E-mail" required error={fieldErrors.email}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.org"
                required
                autoComplete={isSetup ? 'email' : 'username'}
              />
            </Field>
            <Field
              label="Password"
              required
              error={fieldErrors.password}
              hint={isSetup ? 'min 8 chars, letters & numbers' : undefined}
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
              />
            </Field>
            {isSetup && (
              <Field label="Confirm password" required error={fieldErrors.confirm}>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required minLength={8} autoComplete="new-password" />
              </Field>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={busy} className="w-full">
              {isSetup ? 'Create account' : 'Sign in'}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
            {isSetup
              ? 'Keep these credentials safe — they control access to the whole registry.'
              : 'Access is restricted to project staff. Activity is logged.'}
          </p>
          <p className="mt-3 text-center text-xs text-ink-faint">
            Registering an organization?{' '}
            <Link href="/submit" className="font-medium text-leaf-700 hover:text-leaf-900">
              Public registration &amp; payment
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
