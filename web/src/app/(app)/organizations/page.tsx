'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Download,
  Trash2,
  ChevronDown,
  Copy,
  AlertTriangle,
  Building2,
  X,
  Filter,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { FilterOptions, Organization, OrgFiltersState } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton } from '@/components/ui/primitives';
import { Drawer, ConfirmDialog } from '@/components/ui/overlays';
import { Pagination } from '@/components/ui/pagination';
import { OrgForm } from '@/components/orgs/org-form';
import { OrgDetail } from '@/components/orgs/org-detail';
import { useToast } from '@/hooks/use-toast';
import { downloadUrl, displayPhone, timeAgo, STATUS_LABELS, STATUS_STYLES } from '@/lib/format';

const PAGE_SIZE = 25;

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function SortHeader({
  label,
  field,
  sort,
  order,
  onSort,
  className = '',
}: {
  label: string;
  field: string;
  sort: string;
  order: string;
  onSort: (f: string) => void;
  className?: string;
}) {
  const active = sort === field;
  return (
    <button onClick={() => onSort(field)} className={`inline-flex items-center gap-1 ${active ? 'text-ink' : 'text-ink-soft hover:text-ink'} ${className}`}>
      {label}
      {active && <ChevronDown className={`h-3 w-3 transition-transform ${order === 'asc' ? 'rotate-180' : ''}`} />}
    </button>
  );
}

export default function OrganizationsPage() {
  const params = useSearchParams();
  const { toast } = useToast();

  const [filters, setFilters] = useState<OrgFiltersState>({
    search: params.get('search') ?? '',
    state: params.get('state') ?? '',
    category: params.get('category') ?? '',
    bank: params.get('bank') ?? '',
    status: params.get('status') ?? '',
    cycle: params.get('cycle') ?? '',
    incomplete: params.get('incomplete') === '1',
    duplicate: params.get('duplicate') === '1',
  });
  const debouncedSearch = useDebounced(filters.search);

  const [sort, setSort] = useState<string>(params.get('sort') ?? 'updated_at');
  const [order, setOrder] = useState<string>(params.get('order') ?? 'desc');
  const [page, setPage] = useState<number>(parseInt(params.get('page') ?? '1', 10) || 1);

  const [rows, setRows] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FilterOptions | null>(null);

  const [openId, setOpenId] = useState<number | null>(params.get('open') ? parseInt(params.get('open')!, 10) : null);
  const [detail, setDetail] = useState<Organization | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [confirmDelete, setConfirmDelete] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    api.filterOptions().then(setOptions).catch(() => {});
  }, []);

  const load = useCallback(
    async (f: OrgFiltersState, p: number, s: string, o: string) => {
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        const { data, meta } = await api.listOrgs(f, { sort: s, order: o, page: p, pageSize: PAGE_SIZE });
        if (seq !== seqRef.current) return;
        setRows(data);
        setTotal(meta.total);
        setPages(meta.pages);
        setSelected(new Set());
      } catch {
        /* keep previous rows */
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const f: OrgFiltersState = { ...filters, search: debouncedSearch };
    load(f, 1, sort, order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.state, filters.category, filters.bank, filters.status, filters.cycle, filters.incomplete, filters.duplicate, sort, order]);

  useEffect(() => {
    if (page > 1) load({ ...filters, search: debouncedSearch }, page, sort, order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openDetail = useCallback(
    async (id: number) => {
      try {
        const { data } = await api.getOrg(id);
        setDetail(data);
        setEditing(false);
        setOpenId(id);
      } catch {
        toast('error', 'Could not load this organization.');
      }
    },
    [toast],
  );

  useEffect(() => {
    if (openId) openDetail(openId);
    else {
      setDetail(null);
    }
  }, [openId, openDetail]);

  const activeFilterCount = [
    filters.state,
    filters.category,
    filters.bank,
    filters.status,
    filters.cycle,
  ].filter(Boolean).length + (filters.incomplete ? 1 : 0) + (filters.duplicate ? 1 : 0) + (filters.search.trim() ? 1 : 0);

  const clearFilters = () => {
    setFilters({ search: '', state: '', category: '', bank: '', status: '', cycle: '', incomplete: false, duplicate: false });
    setPage(1);
  };

  const onSortClick = (field: string) => {
    if (sort === field) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(field);
      setOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const toggleSelect = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  async function doDelete(org: Organization) {
    setDeleting(true);
    try {
      await api.deleteOrg(org.id);
      toast('success', `Deleted “${org.name}”.`);
      setConfirmDelete(null);
      setOpenId(null);
      load({ ...filters, search: debouncedSearch }, page, sort, order);
    } catch {
      toast('error', 'Delete failed. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function doBulkDelete() {
    setDeleting(true);
    try {
      const { deleted } = await api.bulkDelete([...selected]);
      toast('success', `Deleted ${deleted} organization${deleted === 1 ? '' : 's'}.`);
      load({ ...filters, search: debouncedSearch }, 1, sort, order);
    } catch {
      toast('error', 'Bulk delete failed. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  const anyFilter = activeFilterCount > 0;
  const emptyIcon = <Building2 className="h-6 w-6" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Organizations</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {total.toLocaleString()} member organizations in the registry.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Button variant="outline" onClick={() => setExportOpen((v) => !v)} aria-haspopup="menu" aria-expanded={exportOpen}>
              <Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div role="menu" className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-stone-200 bg-white p-1.5 shadow-pop animate-scale-in">
                  <button
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-stone-50"
                    onClick={() => {
                      setExportOpen(false);
                      downloadUrl(api.exportUrl({ ...filters, search: debouncedSearch }, 'xlsx'));
                    }}
                  >
                    Excel (.xlsx) {anyFilter && <span className="text-ink-faint">· current filters</span>}
                  </button>
                  <button
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-stone-50"
                    onClick={() => {
                      setExportOpen(false);
                      downloadUrl(api.exportUrl({ ...filters, search: debouncedSearch }, 'csv'));
                    }}
                  >
                    CSV (.csv) {anyFilter && <span className="text-ink-faint">· current filters</span>}
                  </button>
                </div>
              </>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(130px,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={filters.search}
              onChange={(e) => {
                setFilters((f) => ({ ...f, search: e.target.value }));
                setPage(1);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Search name, contact, phone, e-mail, account…"
              className="pl-9"
              aria-label="Search organizations"
            />
            {searchFocused && filters.search && (
              <button
                onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-faint hover:text-ink"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={filters.state} onChange={(e) => { setFilters((f) => ({ ...f, state: e.target.value })); setPage(1); }} aria-label="Filter by state">
            <option value="">All states</option>
            {(options?.states ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select value={filters.category} onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(1); }} aria-label="Filter by project category">
            <option value="">All categories</option>
            {(options?.categories ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select value={filters.bank} onChange={(e) => { setFilters((f) => ({ ...f, bank: e.target.value })); setPage(1); }} aria-label="Filter by bank">
            <option value="">All banks</option>
            {(options?.banks ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses</option>
            {(options?.statuses ?? ['registered', 'in_review', 'approved', 'rejected', 'inactive']).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
            ))}
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setFilters((f) => ({ ...f, incomplete: !f.incomplete })); setPage(1); }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
              filters.incomplete
                ? 'bg-rose-50 text-rose-700 ring-rose-200'
                : 'bg-white text-ink-soft ring-stone-300 hover:bg-stone-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Incomplete
          </button>
          <button
            onClick={() => { setFilters((f) => ({ ...f, duplicate: !f.duplicate })); setPage(1); }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
              filters.duplicate
                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                : 'bg-white text-ink-soft ring-stone-300 hover:bg-stone-50'
            }`}
          >
            <Copy className="h-3.5 w-3.5" /> Duplicates
          </button>
          {filters.cycle && (
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-ink-soft">
              Cycle: {filters.cycle}
              <button onClick={() => setFilters((f) => ({ ...f, cycle: '' }))} aria-label="Clear cycle filter"><X className="h-3 w-3" /></button>
            </span>
          )}
          {anyFilter && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-leaf-700 hover:text-leaf-900">
              <Filter className="h-3.5 w-3.5" /> Clear all ({activeFilterCount})
            </button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-ink-faint">Sort:</span>
            {(['updated_at', 'name', 'sn'] as const).map((f) => (
              <button
                key={f}
                onClick={() => onSortClick(f)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  sort === f ? 'bg-leaf-50 text-leaf-800 ring-1 ring-inset ring-leaf-200' : 'text-ink-soft hover:bg-stone-100'
                }`}
              >
                {f === 'updated_at' ? 'Recently updated' : f === 'name' ? 'Name' : 'S/N'} {sort === f && (order === 'asc' ? '↑' : '↓')}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-bark-900 px-4 py-2.5 text-white shadow-pop animate-fade-up">
          <p className="text-[13px] font-medium">{selected.size} selected</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="!bg-transparent !text-white !ring-white/30 hover:!bg-white/10" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="danger" onClick={() => doBulkDelete()}>
              <Trash2 className="h-3.5 w-3.5" /> Delete selected
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
                    }
                    className="h-4 w-4 rounded border-stone-300 text-leaf-700 focus:ring-leaf-600"
                    aria-label="Select all on this page"
                  />
                </th>
                <th className="px-3 py-3">
                  <SortHeader label="S/N" field="sn" sort={sort} order={order} onSort={onSortClick} />
                </th>
                <th className="px-3 py-3">
                  <SortHeader label="Organization" field="name" sort={sort} order={order} onSort={onSortClick} />
                </th>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">
                  <SortHeader label="Updated" field="updated_at" sort={sort} order={order} onSort={onSortClick} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && rows.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-3">
                        <Skeleton className="h-7 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => openDetail(o.id)}
                      className="group cursor-pointer transition hover:bg-leaf-50/40"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                          className="h-4 w-4 rounded border-stone-300 text-leaf-700 focus:ring-leaf-600"
                          aria-label={`Select ${o.name}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-[13px] tabular-nums text-ink-faint">{o.sn ?? '—'}</td>
                      <td className="max-w-[320px] px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium text-ink group-hover:text-leaf-900">{o.name}</span>
                          {o.is_duplicate && (
                            <span title="Possible duplicate" className="shrink-0"><Copy className="h-3.5 w-3.5 text-amber-500" /></span>
                          )}
                        </div>
                        <div className="truncate text-xs text-ink-faint">{o.ceo_name ?? ''}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-[13px] text-ink-soft">{o.phone ? displayPhone(o.phone) : <span className="text-ink-faint">—</span>}</div>
                        <div className="truncate text-xs text-ink-faint">{o.email ?? ''}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-[13px] text-ink-soft">{o.state_norm ?? o.state ?? <span className="text-ink-faint">—</span>}</div>
                        <div className="truncate text-xs text-ink-faint">{o.lga ?? ''}</div>
                      </td>
                      <td className="max-w-[240px] px-3 py-3">
                        <div className="truncate text-[13px] text-ink-soft">{o.project_type ?? <span className="text-ink-faint">—</span>}</div>
                        <div className="mt-0.5">
                          <Badge tone="sky">{o.project_category}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLES[o.status] ?? ''}`}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-ink-faint">{timeAgo(o.updated_at)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!loading && rows.length === 0 && (
          <EmptyState
            icon={emptyIcon}
            title={anyFilter ? 'No organizations match these filters' : 'No organizations yet'}
            description={
              anyFilter
                ? 'Try adjusting or clearing the filters to see more results.'
                : 'Add your first organization manually, or import your existing Excel registry in one click.'
            }
            action={
              anyFilter ? (
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              ) : (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> Add organization
                </Button>
              )
            }
          />
        )}

        {rows.length > 0 && (
          <div className="border-t border-stone-100">
            <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        )}
      </Card>

      {/* Detail drawer */}
      <Drawer
        open={openId !== null && !!detail}
        onClose={() => setOpenId(null)}
        title={detail?.name ?? 'Organization'}
        footer={
          detail && !editing ? (
            <div className="flex justify-between">
              <Button variant="ghost" className="!text-rose-600 hover:!bg-rose-50" onClick={() => setConfirmDelete(detail)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <Button onClick={() => setEditing(true)}>Edit</Button>
            </div>
          ) : undefined
        }
      >
        {detail &&
          (editing ? (
            <OrgForm
              org={detail}
              onCancel={() => setEditing(false)}
              onSaved={(o) => {
                setEditing(false);
                openDetail(o.id);
                load({ ...filters, search: debouncedSearch }, page, sort, order);
              }}
            />
          ) : (
            <OrgDetail
              org={detail}
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmDelete(detail)}
              onOpenDuplicate={(id) => openDetail(id)}
            />
          ))}
      </Drawer>

      {/* Create drawer */}
      <Drawer open={creating} onClose={() => setCreating(false)} title="Add organization">
        <OrgForm
          onCancel={() => setCreating(false)}
          onSaved={(o) => {
            setCreating(false);
            load({ ...filters, search: debouncedSearch }, page, sort, order);
            openDetail(o.id);
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        loading={deleting}
        title="Delete organization?"
        message={
          <>
            <span className="font-semibold text-ink">{confirmDelete?.name}</span> will be removed from the registry. This action
            cannot be undone, but it is recorded in the audit log.
          </>
        }
      />
    </div>
  );
}
