import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  Lock,
  Search,
  ShieldCheck,
  Sprout,
  Wallet,
} from 'lucide-react';
import { FEE_OPTIONS } from '@/lib/constants';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-leaf-400 to-leaf-700 shadow-sm ring-1 ring-white/20">
              <Sprout className="h-5.5 w-5.5 text-white" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-[19px] font-semibold tracking-tight text-ink">Sambet</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">Grassroots Project</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/track"
              className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-soft transition hover:text-ink sm:inline-flex"
            >
              Track submission
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-ink-soft ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50 hover:text-ink"
            >
              <Lock className="h-3.5 w-3.5" /> Staff
            </Link>
            <Link
              href="/submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-leaf-700 px-4 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-leaf-800"
            >
              Register <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(600px 280px at 15% 0%, rgba(79,171,132,0.14), transparent 70%), radial-gradient(500px 260px at 90% 10%, rgba(217,164,65,0.10), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-800 ring-1 ring-inset ring-leaf-200">
            <BadgeCheck className="h-3.5 w-3.5" /> Grassroots Project · member organization registry
          </p>
          <h1 className="mt-5 max-w-2xl font-display text-[38px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[52px]">
            Your community organization, <span className="text-leaf-700">officially in the registry.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-soft">
            Pay the registration fee by bank transfer, upload a picture of your proof of payment, and our team
            verifies your organization into the Grassroots Project member registry.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/submit"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-leaf-700 px-6 text-[15px] font-semibold text-white shadow-sm transition hover:bg-leaf-800"
            >
              Register your organization <ArrowRight className="h-4.5 w-4.5" />
            </Link>
            <Link
              href="/track"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-medium text-ink ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50"
            >
              <Search className="h-4.5 w-4.5" /> Track my submission
            </Link>
          </div>

          {/* fee strip */}
          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {FEE_OPTIONS.map((f) => (
              <div key={f.value} className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-card">
                <p className="flex items-center gap-2 text-[17px] font-bold text-leaf-900">
                  <Banknote className="h-4.5 w-4.5 text-leaf-600" /> {f.label}
                </p>
                <p className="mt-1 text-[12.5px] text-ink-soft">{f.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="border-t border-stone-200/70 bg-white/60">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-[24px] font-semibold tracking-tight text-ink">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Wallet,
                title: '1 · Make the transfer',
                text: 'Pay the registration fee to the project bank account. Keep the transfer receipt — you will upload a picture of it.',
              },
              {
                icon: Banknote,
                title: '2 · Submit your details',
                text: 'Fill in a short form with your organization name, phone, state and bank details, and upload your proof of payment.',
              },
              {
                icon: CheckCircle2,
                title: '3 · We verify & register',
                text: 'Our team confirms the payment, adds your organization to the registry, and you can track it anytime with your reference.',
              },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-50 ring-1 ring-inset ring-leaf-200">
                  <s.icon className="h-5.5 w-5.5 text-leaf-700" />
                </span>
                <p className="mt-4 text-[15px] font-semibold text-ink">{s.title}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* trust band */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Building2, title: 'A real registry', text: 'Thousands of member organizations, searchable and exportable, managed in one place.' },
            { icon: ShieldCheck, title: 'Verified payments', text: 'Every submission is checked against its proof of payment before it is registered.' },
            { icon: Lock, title: 'Private by design', text: 'Your details are only used to verify your payment and register your organization.' },
          ].map((t) => (
            <div key={t.title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                <t.icon className="h-5 w-5 text-ink-soft" />
              </span>
              <span>
                <span className="block text-[14.5px] font-semibold text-ink">{t.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-ink-soft">{t.text}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-stone-200/70">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-[12.5px] text-ink-faint sm:px-6">
          <span className="flex items-center gap-2">
            <Sprout className="h-4 w-4 text-leaf-600" /> Sambet Grassroots Project · member organization registry
          </span>
          <span>
            Staff?{' '}
            <Link href="/login" className="font-medium text-ink-soft hover:text-ink">
              Sign in
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
