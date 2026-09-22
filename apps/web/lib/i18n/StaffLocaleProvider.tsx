'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { STAFF_LOCALE_COOKIE, type Copy, type StaffLocale } from './staffLocale';

interface StaffLocaleValue {
  locale: StaffLocale;
  setLocale: (locale: StaffLocale) => void;
}

const StaffLocaleContext = createContext<StaffLocaleValue>({ locale: 'en', setLocale: () => {} });

/**
 * Holds the staff language the server rendered with. Changing it writes the
 * cookie and asks the server to render again, so server and client never
 * disagree and nothing flashes in the wrong language.
 */
export function StaffLocaleProvider({ locale, children }: { locale: StaffLocale; children: ReactNode }) {
  const router = useRouter();

  const setLocale = useCallback(
    (next: StaffLocale) => {
      document.cookie = `${STAFF_LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <StaffLocaleContext.Provider value={value}>{children}</StaffLocaleContext.Provider>;
}

export function useStaffLocale(): StaffLocaleValue {
  return useContext(StaffLocaleContext);
}

/** Picks this component's text in the current staff language. English outside the provider. */
export function useCopy<T>(copy: Copy<T>): T {
  return copy[useStaffLocale().locale];
}
