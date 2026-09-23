'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
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
 *
 * The switch also takes effect in this tab at once. Next serves the new route
 * from a payload it prefetched with the previous cookie, so waiting for the
 * server would leave the presenter looking at an interviewer's sidebar on a
 * commission screen. The layout gives this provider the server's role as its
 * `key`, so a server render with a different cookie remounts it and that value
 * wins again.
 */
export function DemoRoleProvider({ role, children }: { role: DemoRole; children: ReactNode }) {
  const router = useRouter();
  const [current, setCurrent] = useState(role);

  const setRole = useCallback(
    (next: DemoRole) => {
      document.cookie = `${DEMO_ROLE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      setCurrent(next);
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ role: current, setRole }), [current, setRole]);
  return <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>;
}

export function useDemoRole(): DemoRoleValue {
  return useContext(DemoRoleContext);
}
