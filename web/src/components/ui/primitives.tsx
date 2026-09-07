'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

/* ---------------- Button ---------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-leaf-700 text-white hover:bg-leaf-800 active:bg-leaf-900 shadow-sm disabled:bg-stone-300',
  secondary:
    'bg-leaf-50 text-leaf-800 ring-1 ring-inset ring-leaf-200 hover:bg-leaf-100 disabled:opacity-50',
  outline:
    'bg-white text-ink ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:opacity-50',
  ghost: 'text-ink-soft hover:bg-stone-100 hover:text-ink disabled:opacity-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:bg-rose-300',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}) {
  const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9.5 px-4 text-sm gap-2',
    lg: 'h-11 px-5 text-sm gap-2',
  };
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 ${sizes[size]} ${BUTTON_STYLES[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------------- Form controls ---------------- */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-medium text-ink">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {hint && <span className="ml-auto text-xs font-normal text-ink-faint">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink shadow-sm ring-1 ring-inset ring-stone-300 placeholder:text-ink-faint focus:ring-2 focus:ring-inset focus:ring-leaf-600 focus:outline-none transition';

export function Input({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} h-9.5 ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputBase} py-2 leading-relaxed ${className}`} rows={3} {...rest} />;
}

export function Select({ className = '', children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputBase} h-9.5 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%2378716c%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.5%206l3.5%204%203.5-4z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}

/* ---------------- Badge ---------------- */

export function Badge({
  tone = 'stone',
  className = '',
  children,
}: {
  tone?: 'stone' | 'green' | 'amber' | 'rose' | 'sky';
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700 ring-stone-200',
    green: 'bg-leaf-50 text-leaf-700 ring-leaf-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ---------------- Card ---------------- */

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-stone-200/80 bg-white shadow-card ${className}`}>{children}</div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Feedback ---------------- */

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-leaf-600 ${className}`} />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-200/70 ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Segmented (small tabs) ---------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 p-0.5 ring-1 ring-inset ring-stone-200">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
