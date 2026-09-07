'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <p className="text-xs text-ink-soft">
        Showing <span className="font-medium text-ink">{from}–{to}</span> of{' '}
        <span className="font-medium text-ink">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-stone-100 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[90px] text-center text-xs font-medium text-ink">
          Page {page} <span className="text-ink-faint">of {pages}</span>
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-stone-100 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
