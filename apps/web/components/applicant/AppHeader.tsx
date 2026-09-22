'use client';

import { ArrowRightStartOnRectangleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useApiErrorText } from '../../lib/api/errorPresentation';
import { useAuth } from '../../lib/auth/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Header for the signed-in area. Denser and quieter than the public one: an
 * applicant is here to work on an application, not to be sold the product.
 */
export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const describeApiError = useApiErrorText();
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function handleLogout() {
    setLeaving(true);
    setProblem(null);
    try {
      await logout();
      router.push('/stand');
    } catch (error) {
      // The server refused and the session is still live, so the applicant
      // stays signed in and is told what to do rather than being shown a
      // signed-out screen that is not true.
      setProblem(describeApiError(error).message);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/stand" className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink">
          <Logo markSize={24} subtitle={false} />
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/stand/profile"
            className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            <UserCircleIcon aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">{user?.fullName ?? 'Profile'}</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={leaving}
            className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
          >
            <ArrowRightStartOnRectangleIcon aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {problem ? (
        <p role="alert" className="border-t border-status-low/30 bg-status-low/10 px-5 py-2 text-center text-sm text-status-low">
          {problem}
        </p>
      ) : null}
    </header>
  );
}
