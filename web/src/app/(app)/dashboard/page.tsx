'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  MapPinned,
  AlertTriangle,
  ClipboardCheck,
  ArrowUpRight,
  Plus,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Stats } from '@/lib/types';
import { Card, CardHeader, Skeleton } from '@/components/ui/primitives';
import { HBarChart, DonutChart } from '@/components/charts/charts';
import { formatNumber, timeAgo, STATUS_LABELS } from '@/lib/format';

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'leaf',
  href,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: 'leaf' | 'amber' | 'sky' | 'stone';
  href?: string;
}) {
  const tones = {
    leaf: 'bg-leaf-50 text-leaf-700 ring-leaf-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100',
    stone: 'bg-stone-100 text-stone-600 ring-stone-200',
  };
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-ink-soft">{label}</p>
          <p className="mt-1.5 text-[30px] font-bold leading-none tracking-tight text-ink tabular">{value}</p>
          <p className="mt-2 text-xs text-ink-faint">{sub}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tones[tone]}`}>{icon}</span>
      </div>
    </>
  );
  const cls = 'group block rounded-2xl border border-stone-200/80 bg-white p-5 shadow-card transition hover:shadow-pop';
  return href ? (
    <Link href={href} className={cls}>
      {inner}
      <span className="mt-3 flex items-center gap-1 text-xs font-medium text-leaf-700 opacity-0 transition group-hover:opacity-100">
        Open <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

const MISSING_LABELS: Record<string, string> = {
  ceo: 'Contact person',
  phone: 'Phone',
  email: 'E-mail',
  state: 'State',
  lga: 'Local government',
  bank: 'Bank',
  account: 'Account no.',
  project: 'Project type',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Could not load the dashboard: {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const completeness = stats.total ? Math.round((stats.complete / stats.total) * 100) : 0;
  const topStates = stats.byState.slice(0, 10).map((s) => ({ label: s.state, value: s.count }));
  const categories = stats.byCategory
    .filter((c) => c.category !== 'Other')
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)
    .map((c) => ({ label: c.category, value: c.count }));
  const otherCat = stats.byCategory.find((c) => c.category === 'Other');
  if (otherCat) categories.push({ label: 'Other', value: otherCat.count });
  const topMissing = [...stats.missing].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Overview of the Grassroots Project member registry — {formatNumber(stats.total)} organizations across{' '}
            {stats.statesCovered} states.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/import" className="inline-flex h-9.5 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-ink ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50">
            <Upload className="h-4 w-4" /> Import
          </Link>
          <Link href="/organizations?new=1" className="inline-flex h-9.5 items-center gap-2 rounded-lg bg-leaf-700 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-leaf-800">
            <Plus className="h-4 w-4" /> Add organization
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Organizations"
          value={formatNumber(stats.total)}
          sub={`${formatNumber(stats.byStatus.find((s) => s.status === 'approved')?.count ?? 0)} approved so far`}
          icon={<Building2 className="h-5 w-5" />}
          href="/organizations"
        />
        <StatCard
          label="States covered"
          value={`${stats.statesCovered} / 37`}
          sub={`${formatNumber(stats.lgasCovered)} local government areas`}
          icon={<MapPinned className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Complete records"
          value={`${completeness}%`}
          sub={`${formatNumber(stats.incomplete)} records need attention`}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="stone"
          href="/organizations?incomplete=1"
        />
        <StatCard
          label="Possible duplicates"
          value={formatNumber(stats.duplicates)}
          sub="Same name in the same state"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
          href="/organizations?duplicate=1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Members by state" subtitle="Top 10 states by registered organizations" />
          <div className="p-5">
            <HBarChart data={topStates} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Projects by category" subtitle="Auto-classified from the project description" />
          <div className="p-5">
            <DonutChart data={categories} centerLabel="" centerSub="projects" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Registration status" />
          <div className="space-y-3.5 p-5">
            {stats.byStatus.map((s) => {
              const pct = stats.total ? Math.round((s.count / stats.total) * 100) : 0;
              return (
                <div key={s.status}>
                  <div className="mb-1 flex justify-between text-[12.5px]">
                    <span className="text-ink-soft">{STATUS_LABELS[s.status] ?? s.status}</span>
                    <span className="font-semibold tabular-nums text-ink">{formatNumber(s.count)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-leaf-500/80" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Fields to complete"
            subtitle="Most-missing fields across the registry"
            action={
              <Link href="/organizations?incomplete=1" className="text-xs font-medium text-leaf-700 hover:text-leaf-900">
                Review →
              </Link>
            }
          />
          <div className="space-y-2.5 p-5">
            {topMissing.map((m) => (
              <div key={m.field} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-ink-soft">{MISSING_LABELS[m.field] ?? m.field}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-700 ring-1 ring-inset ring-amber-200">
                  {formatNumber(m.count)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recently updated"
            action={
              <Link href="/organizations?sort=updated_at&order=desc" className="text-xs font-medium text-leaf-700 hover:text-leaf-900">
                View all →
              </Link>
            }
          />
          <ul className="divide-y divide-stone-100">
            {stats.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/organizations?open=${o.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-stone-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{o.name}</span>
                    <span className="block truncate text-xs text-ink-faint">
                      {o.state_norm ?? 'Unknown state'} · {o.project_category}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(o.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {stats.recentImports.length > 0 && (
        <Card>
          <CardHeader
            title="Recent imports"
            action={
              <Link href="/import" className="text-xs font-medium text-leaf-700 hover:text-leaf-900">
                Import data →
              </Link>
            }
          />
          <ul className="divide-y divide-stone-100">
            {stats.recentImports.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{i.filename}</span>
                <span className="text-ink-soft">
                  <span className="font-semibold text-leaf-700">+{i.created_count}</span> added ·{' '}
                  <span className="font-semibold text-sky-700">{i.updated_count}</span> updated ·{' '}
                  <span className="font-semibold text-stone-500">{i.skipped_count}</span> skipped
                </span>
                <span className="text-xs text-ink-faint">{timeAgo(i.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
