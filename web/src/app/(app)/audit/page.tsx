'use client';

import React, { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import type { AuditRow } from '@/lib/types';
import { Card, EmptyState, Select, Skeleton } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { actionLabel, formatDateTime } from '@/lib/format';

const PAGE_SIZE = 25;

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .audit(page, action || undefined)
      .then((r) => {
        setRows(r.data);
        setTotal(r.meta.total);
        setPages(r.meta.pages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, action]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Audit log</h1>
          <p className="mt-1 text-sm text-ink-soft">Every sign-in, change, deletion and import — who did what, and when.</p>
        </div>
        <div className="w-56">
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter by action">
            <option value="">All actions</option>
            <option value="auth.login">Sign-ins</option>
            <option value="org.create">Additions</option>
            <option value="org.update">Updates</option>
            <option value="org.delete">Deletions</option>
            <option value="org.bulk_delete">Bulk deletions</option>
            <option value="import.completed">Imports</option>
            <option value="account.setup">Account setup</option>
            <option value="password.change">Password changes</option>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                <th className="px-5 py-3">When</th>
                <th className="px-3 py-3">Action</th>
                <th className="px-3 py-3">Actor</th>
                <th className="px-3 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-5 py-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((r) => {
                    const details =
                      typeof r.details === 'object' && r.details !== null
                        ? Object.entries(r.details)
                            .filter(([, v]) => v !== null && v !== undefined && v !== '')
                            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                            .join(' · ')
                        : typeof r.details === 'string'
                          ? r.details
                          : '';
                    return (
                      <tr key={r.id} className="hover:bg-stone-50/60">
                        <td className="whitespace-nowrap px-5 py-3 text-[12.5px] tabular-nums text-ink-faint">{formatDateTime(r.created_at)}</td>
                        <td className="px-3 py-3">
                          <span className="text-[13px] font-medium text-ink">{actionLabel(r.action)}</span>
                          {r.entity_id && <span className="ml-1.5 text-xs text-ink-faint">#{r.entity_id}</span>}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-ink-soft">{r.actor_email ?? '—'}</td>
                        <td className="max-w-[420px] truncate px-3 py-3 text-[12.5px] text-ink-soft" title={details}>
                          {details || <span className="text-ink-faint">—</span>}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && (
          <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No activity yet" description="Actions performed in the registry will appear here." />
        )}
        {rows.length > 0 && (
          <div className="border-t border-stone-100">
            <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
