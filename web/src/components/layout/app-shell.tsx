'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Upload,
  ScrollText,
  Settings,
  LogOut,
  Sprout,
  Menu,
  X,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { initials } from '@/lib/format';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/organizations', label: 'Organizations', icon: Building2 },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/team', label: 'Team', icon: Users, adminOnly: true },
  { href: '/audit', label: 'Audit log', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-leaf-400 to-leaf-700 shadow-inner ring-1 ring-white/20">
        <Sprout className="h-5 w-5 text-white" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[17px] font-semibold tracking-tight text-white">Sambet</span>
        <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-leaf-300/80">Grassroots Registry</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV.filter((i) => !i.adminOnly || user?.role === 'admin');

  const nav = (onNav?: () => void) => (
    <nav className="mt-6 flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNav}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition ${
              active
                ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/10'
                : 'text-leaf-100/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon className={`h-[18px] w-[18px] ${active ? 'text-leaf-300' : 'text-leaf-200/40 group-hover:text-leaf-200/80'}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <div className="mt-4 border-t border-white/10 p-3">
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
        <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-leaf-400/20 text-[12px] font-bold text-leaf-200 ring-1 ring-leaf-300/30">
          {user ? initials(user.name) : '·'}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium text-white">{user?.name ?? '…'}</span>
          <span className="block truncate text-[11px] text-leaf-200/50">{user?.email ?? ''}</span>
        </span>
        <button
          onClick={async () => {
            await logout();
            router.replace('/login');
          }}
          className="rounded-lg p-2 text-leaf-200/50 transition hover:bg-white/10 hover:text-white"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-gradient-to-b from-bark-800 via-bark-900 to-bark-950 lg:flex">
        <div className="px-5 pb-2 pt-6">
          <Brand />
        </div>
        {nav()}
        {userBlock}
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-stone-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-ink-soft hover:bg-stone-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-stone-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-gradient-to-b from-bark-800 via-bark-900 to-bark-950">
            <div className="flex items-center justify-between px-4 pt-4">
              <Brand />
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-leaf-200/60 hover:bg-white/10" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav(() => setMobileOpen(false))}
            {userBlock}
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
