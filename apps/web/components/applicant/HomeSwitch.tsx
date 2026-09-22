'use client';

import type { ReactNode } from 'react';
import { ApplicantHome } from './ApplicantHome';
import { useAuth } from '../../lib/auth/AuthContext';

/**
 * The root route is the landing page for a visitor and the applicant's home for
 * someone signed in — the flow the S2 specification fixes, and what closes
 * CON-010 together with the redirects after sign-in and registration.
 *
 * While the session is still being resolved the landing stays on screen. Most
 * arrivals are signed out, and showing the page we already rendered on the
 * server beats a spinner that flashes for everyone.
 */
export function HomeSwitch({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'authenticated') return <ApplicantHome />;
  return <>{children}</>;
}
