'use client';

import { useEffect } from 'react';
import { useAuth } from '../lib/auth/AuthContext';
import { useRouter } from 'next/navigation';

/**
 * Client-side route gate only. The backend enforces the real authorization
 * boundary on every request; this exists to avoid flashing staff/applicant
 * screens before the session state is known (AGENTS.md: "Hiding a button in
 * the UI is not authorization").
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/stand/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-base px-6 text-center">
        <p className="text-sm text-text-secondary">Checking your session…</p>
      </main>
    );
  }

  return <>{children}</>;
}
