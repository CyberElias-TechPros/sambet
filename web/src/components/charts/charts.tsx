'use client';

import React from 'react';

const PALETTE = [
  '#1F7350', '#4FAB84', '#82C7A8', '#D9A441', '#B4653A',
  '#5B7DB1', '#8A6FB8', '#3E8E8C', '#A85751', '#6B8E4E',
  '#7A7267', '#2E6E89', '#9C8457',
];

export function HBarChart({
  data,
  max,
  unit = '',
}: {
  data: { label: string; value: number }[];
  max?: number;
  unit?: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="px-1 py-8 text-center text-sm text-ink-faint">No data yet</p>;
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
            <span className="truncate text-ink-soft group-hover:text-ink">{d.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {d.value.toLocaleString()}
              {unit}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-leaf-600 to-leaf-400 transition-all duration-500"
              style={{ width: `${Math.max(2, (d.value / top) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  data,
  centerLabel,
  centerSub,
}: {
  data: { label: string; value: number }[];
  centerLabel: string;
  centerSub?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  if (!total) return <p className="px-1 py-8 text-center text-sm text-ink-faint">No data yet</p>;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#F0EFEB" strokeWidth="12" />
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * C;
            const el = (
              <circle
                key={d.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth="12"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                className="transition-all duration-500"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-ink">{total.toLocaleString()}</span>
          {centerSub && <span className="text-[11px] text-ink-faint">{centerSub}</span>}
        </div>
      </div>
      <ul className="min-w-[150px] flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-ink-soft">{d.label}</span>
            <span className="font-semibold tabular-nums text-ink">{d.value.toLocaleString()}</span>
            <span className="w-10 text-right tabular-nums text-ink-faint">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
