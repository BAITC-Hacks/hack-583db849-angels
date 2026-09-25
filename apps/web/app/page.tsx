'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { demoRoles, homeFor, type DemoRole } from '../lib/roles';

/** Each role starts on its own home. */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let role: DemoRole = 'interviewer';
    try {
      const stored = localStorage.getItem('invision-demo-role');
      if (demoRoles.includes(stored as DemoRole)) role = stored as DemoRole;
    } catch {
      // Blocked storage keeps the default role.
    }
    router.replace(homeFor[role]);
  }, [router]);

  return null;
}
