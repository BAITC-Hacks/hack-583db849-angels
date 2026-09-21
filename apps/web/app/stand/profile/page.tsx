'use client';

import { CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { AppHeader } from '../../../components/applicant/AppHeader';
import { JourneyRail } from '../../../components/applicant/JourneyRail';
import { Badge } from '../../../components/ui/Badge';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { useAuth } from '../../../lib/auth/AuthContext';
import { formatDateTime } from '../../../lib/format';

const upcoming = ['Ipsative test', 'Video', 'Submission'];

function ProfileContent() {
  const { user, accessExpiresAt } = useAuth();

  if (!user) return null;

  return (
    <>
      <AppHeader />
      <JourneyRail />

      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Profile</p>
        <h1 className="mt-2 text-balance-tight text-2xl font-extrabold sm:text-3xl">{user.fullName}</h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Account details. The progress of your application lives on the{' '}
          <Link href="/stand" className="font-medium text-brand-ink hover:underline">
            home screen
          </Link>
          .
        </p>

        <section className="mt-8 rounded-panel border border-border-subtle bg-bg-surface p-6">
          <h2 className="text-sm font-semibold text-text-primary">Account</h2>
          <dl className="mt-5 grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-text-muted uppercase">Email</dt>
              <dd className="mt-1 font-medium text-text-primary">{user.email}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-text-muted uppercase">Role</dt>
              <dd className="mt-1">
                <Badge tone="neutral">{user.role}</Badge>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-text-muted uppercase">Account created</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-text-primary">
                {formatDateTime(user.createdAt)}
              </dd>
            </div>
            {accessExpiresAt ? (
              <div>
                <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-text-muted uppercase">
                  Session valid until
                </dt>
                <dd className="mt-1 font-mono text-sm tabular-nums text-text-primary">
                  {new Date(accessExpiresAt).toLocaleTimeString('en')}
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="mt-6 border-l-2 border-border-strong pl-3 text-xs text-text-muted">
            {"The IIN is not shown here: it is encrypted at rest, excluded from assessment and never returned in the system's responses."}
          </p>
        </section>

        <section className="mt-6 rounded-panel border border-border-subtle bg-bg-surface p-6">
          <h2 className="text-sm font-semibold text-text-primary">Your path</h2>
          <ol className="mt-5 flex flex-col gap-4">
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green text-on-brand">
                <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium text-text-primary">Account created</span>
            </li>
            {upcoming.map((step) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong text-text-muted">
                  <LockClosedIcon aria-hidden="true" className="h-3 w-3" />
                </span>
                <span className="text-sm text-text-muted">{step}</span>
                <span className="ml-auto font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
                  Later slice
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
