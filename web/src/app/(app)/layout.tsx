'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sprout } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    } else if (!loading) {
      setDecided(true);
    }
  }, [loading, user, router]);

  if (!decided) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf-400 to-leaf-700 shadow-sm ring-1 ring-black/5">
            <Sprout className="h-6 w-6 text-white" />
          </span>
          <span className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-leaf-200 border-t-leaf-600" />
            Loading Sambet…
          </span>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
