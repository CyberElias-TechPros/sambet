import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  Lock,
  MapPinned,
  Search,
  ShieldCheck,
  Sprout,
  Wallet,
} from 'lucide-react';
import { FEE_OPTIONS } from '@/lib/constants';

/** Decorative preview of the staff registry console — pure markup, no data. */
function RegistryMockup() {
  const bars = [42, 58, 34, 66, 48, 74, 40, 62, 52, 46, 68, 38];
  const rows = [
    { name: 'Imuetinyan Emokpae CDA', state: 'Edo', tag: 'Approved' },
    { name: 'Unity Farmers Cooperative', state: 'Kano', tag: 'Approved' },
    { name: "Umuada Women's Group", state: 'Abia', tag: 'Verified' },
  ];
  return (
    <div className="relative" aria-hidden="true">
      {/* soft glow behind the panel */}
      <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-gradient-to-br from-leaf-200/60 via-leaf-100/40 to-gold-200/50 blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-glow">
        {/* window bar */}
        <div className="flex items-center gap-1.5 border-b border-stone-100 bg-white px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-stone-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-stone-200" />
          <span className="ml-3 hidden rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-ink-faint sm:block">
            registry.sambet.ng
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-2 py-0.5 text-[10.5px] font-semibold text-leaf-700 ring-1 ring-inset ring-leaf-200">
            <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
            Registry live
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {/* mini stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Building2, label: 'Organizations', value: '2,000+' },
              { icon: MapPinned, label: 'States', value: '37' },
              { icon: BadgeCheck, label: 'Payments', value: 'Verified' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-stone-50 p-2.5 ring-1 ring-inset ring-stone-100">
                <s.icon className="h-4 w-4 text-leaf-600" />
                <p className="mt-1.5 text-[14px] font-bold leading-none tabular text-ink">{s.value}</p>
                <p className="mt-1 truncate text-[10px] font-medium text-ink-faint">{s.label}</p>
              </div>
            ))}
          </div>

          {/* mini chart */}
          <div className="mt-3 rounded-xl border border-stone-100 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-ink">Members by state</p>
              <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                <span className="h-2 w-2 rounded-[3px] bg-leaf-500" /> Registered
              </span>
            </div>
            <div className="mt-3 flex h-16 items-end gap-1">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t-[3px] ${i % 3 === 1 ? 'bg-leaf-400' : 'bg-leaf-600/80'}`}
                  style={{ height: `${h}%`, opacity: 0.55 + (i % 4) * 0.12 }}
                />
              ))}
            </div>
          </div>

          {/* rows */}
          <ul className="mt-3 space-y-1.5">
            {rows.map((r) => (
              <li
                key={r.name}
                className="flex items-center gap-2.5 rounded-xl border border-stone-100 bg-white px-3 py-2 transition hover:border-leaf-200"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-[10px] font-bold text-leaf-700">
                  {r.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[12.5px] font-medium text-ink">{r.name}</span>
                  <span className="block text-[10.5px] text-ink-faint">{r.state} State</span>
                </span>
                <span className="shrink-0 rounded-full bg-leaf-50 px-2 py-0.5 text-[10px] font-semibold text-leaf-700 ring-1 ring-inset ring-leaf-200">
                  {r.tag}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* floating chips */}
      <div className="absolute -left-5 top-14 hidden animate-float items-center gap-2.5 rounded-xl border border-stone-200/80 bg-white p-3 shadow-pop sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-leaf-50 ring-1 ring-inset ring-leaf-200">
          <CheckCircle2 className="h-4 w-4 text-leaf-600" />
        </span>
        <span className="leading-tight">
          <span className="block text-[12px] font-semibold text-ink">Payment verified</span>
          <span className="block text-[10.5px] text-ink-faint">by our staff team</span>
        </span>
      </div>
      <div className="absolute -right-4 bottom-12 hidden animate-float items-center gap-2.5 rounded-xl border border-stone-200/80 bg-white p-3 shadow-pop [animation-delay:1.4s] sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-100 ring-1 ring-inset ring-gold-200">
          <Sprout className="h-4 w-4 text-gold-600" />
        </span>
        <span className="leading-tight">
          <span className="block text-[12px] font-semibold text-ink">Added to the registry</span>
          <span className="block text-[10.5px] text-ink-faint">track any time</span>
        </span>
      </div>
    </div>
  );
}

const STEPS = [
  {
    icon: Wallet,
    title: 'Make the transfer',
    text: 'Pay the registration fee to the project bank account. Keep the transfer receipt — you will upload a picture of it.',
  },
  {
    icon: Banknote,
    title: 'Submit your details',
    text: 'Fill in a short form with your organization name, phone, state and bank details, and upload your proof of payment.',
  },
  {
    icon: CheckCircle2,
    title: 'We verify & register',
    text: 'Our team confirms the payment, adds your organization to the registry, and you can track it anytime with your reference.',
  },
];

const TRUST = [
  {
    icon: Building2,
    title: 'A real registry',
    text: 'Member organizations with contacts, banks and locations — searchable, complete and always exportable.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified payments',
    text: 'Every submission is checked against its proof of payment before it is registered.',
  },
  {
    icon: Lock,
    title: 'Private by design',
    text: 'Your details are only used to verify your payment and register your organization.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-leaf-400 to-leaf-700 shadow-sm ring-1 ring-white/20">
              <Sprout className="h-5.5 w-5.5 text-white" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-[19px] font-semibold tracking-tight text-ink">Sambet</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">Grassroots Project</p>
            </div>
          </div>
          <nav className="flex items-center gap-1.5">
            <Link
              href="#how-it-works"
              className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-soft transition hover:text-ink md:inline-flex"
            >
              How it works
            </Link>
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-leaf-700 px-4 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-leaf-800 active:scale-[0.98]"
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
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-800 ring-1 ring-inset ring-leaf-200">
              <BadgeCheck className="h-3.5 w-3.5" /> Sambet Grassroots Project · member organization registry
            </p>
            <h1 className="text-balance mt-5 max-w-2xl font-display text-[38px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[54px]">
              Your community organization,{' '}
              <span className="bg-gradient-to-r from-leaf-700 via-leaf-600 to-leaf-400 bg-clip-text text-transparent">
                officially in the registry.
              </span>
            </h1>
            <p className="text-balance mt-5 max-w-xl text-[16px] leading-relaxed text-ink-soft">
              Pay the registration fee by bank transfer, upload a picture of your proof of payment, and our team
              verifies your organization into the Grassroots Project member registry.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/submit"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-leaf-700 px-6 text-[15px] font-semibold text-white shadow-sm transition hover:bg-leaf-800 hover:shadow-card-hover active:scale-[0.98]"
              >
                Register your organization <ArrowRight className="h-4.5 w-4.5" />
              </Link>
              <Link
                href="/track"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-medium text-ink ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50 hover:ring-stone-400 active:scale-[0.98]"
              >
                <Search className="h-4.5 w-4.5" /> Track my submission
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-ink-soft">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-leaf-600" /> No login needed to register
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-leaf-600" /> Track any time with your reference
              </span>
            </div>

            {/* fee strip */}
            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {FEE_OPTIONS.map((f) => (
                <div key={f.value} className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-card transition hover:shadow-card-hover">
                  <p className="flex items-center gap-2 text-[17px] font-bold text-leaf-900">
                    <Banknote className="h-4.5 w-4.5 text-leaf-600" /> {f.label}
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-soft">{f.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-in [animation-delay:0.15s]">
            <RegistryMockup />
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how-it-works" className="border-t border-stone-200/70 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf-700">Three simple steps</p>
            <h2 className="text-balance mt-2 font-display text-[28px] font-semibold tracking-tight text-ink sm:text-[34px]">
              From bank transfer to registered member
            </h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                {i < STEPS.length - 1 && (
                  <span className="absolute -right-4 top-11 hidden h-0.5 w-4 border-t-2 border-dashed border-leaf-200 md:block" />
                )}
                <div className="h-full rounded-2xl border border-stone-200/80 bg-white p-6 shadow-card transition hover:shadow-card-hover">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-50 ring-1 ring-inset ring-leaf-200">
                      <s.icon className="h-5.5 w-5.5 text-leaf-700" />
                    </span>
                    <span className="font-display text-[40px] font-semibold leading-none text-stone-200/80">{i + 1}</span>
                  </div>
                  <p className="mt-4 text-[15px] font-semibold text-ink">{s.title}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* trust band */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {TRUST.map((t) => (
            <div key={t.title} className="flex gap-3.5 rounded-2xl border border-stone-200/70 bg-white/70 p-5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-50 ring-1 ring-inset ring-leaf-100">
                <t.icon className="h-5 w-5 text-leaf-700" />
              </span>
              <span>
                <span className="block text-[14.5px] font-semibold text-ink">{t.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-ink-soft">{t.text}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* closing CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-bark-800 via-bark-900 to-bark-950 px-6 py-14 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 20%, #4FAB84 0, transparent 34%), radial-gradient(circle at 85% 15%, #2E8C65 0, transparent 30%), radial-gradient(circle at 70% 90%, #1F7350 0, transparent 40%)',
            }}
          />
          <div className="relative">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf-400 to-leaf-700 shadow-inner ring-1 ring-white/20">
              <Sprout className="h-6 w-6 text-white" />
            </span>
            <h2 className="text-balance mx-auto mt-5 max-w-xl font-display text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[36px]">
              From a spreadsheet to a registry the whole project can trust.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[14.5px] leading-relaxed text-leaf-100/60">
              Registering takes a few minutes. The project team verifies your payment and your organization becomes a
              registered member of the Sambet Grassroots Project.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/submit"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-leaf-500 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-400 active:scale-[0.98]"
              >
                Register your organization <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-medium text-leaf-100 ring-1 ring-inset ring-white/20 transition hover:bg-white/5 hover:text-white"
              >
                <Lock className="h-4 w-4" /> Staff sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-[12.5px] text-ink-faint sm:px-6">
          <span className="flex items-center gap-2">
            <Sprout className="h-4 w-4 text-leaf-600" /> Sambet Grassroots Project · member organization registry
          </span>
          <span className="flex items-center gap-4">
            <Link href="/track" className="transition hover:text-ink">
              Track submission
            </Link>
            <span>
              Staff?{' '}
              <Link href="/login" className="font-medium text-ink-soft hover:text-ink">
                Sign in
              </Link>
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
