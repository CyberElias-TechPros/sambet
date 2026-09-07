'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-leaf-200 border-t-leaf-600" />
          <p className="text-sm text-ink-soft">Loading Sambet…</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
