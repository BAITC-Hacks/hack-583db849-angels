'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { DEMO_ROLE_COOKIE, type DemoRole } from './roles';

interface DemoRoleValue {
  role: DemoRole;
  setRole: (role: DemoRole) => void;
}

const DemoRoleContext = createContext<DemoRoleValue>({ role: 'interviewer', setRole: () => {} });

/**
 * Holds the role the server rendered with. Switching it writes the cookie and
 * asks the server to render again, so the screen and the API key the server
 * uses can never disagree.
 */
export function DemoRoleProvider({ role, children }: { role: DemoRole; children: ReactNode }) {
  const router = useRouter();

  const setRole = useCallback(
    (next: DemoRole) => {
      document.cookie = `${DEMO_ROLE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);
  return <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>;
}

export function useDemoRole(): DemoRoleValue {
  return useContext(DemoRoleContext);
}
