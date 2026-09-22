'use client';

import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { homeFor } from '../../lib/demo/world';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { createPreference } from '../../lib/preference';
import { useDemoRole } from '../../lib/DemoRoleProvider';
import { isStaff, type DemoRole } from '../../lib/roles';
import { RoleTile } from './RoleSwitcher';
import { Sidebar } from './Sidebar';

const useSidebarState = createPreference<'open' | 'folded'>('invision-sidebar', 'open', ['open', 'folded']);

/**
 * The frame around every product screen: a sidebar on wide screens, a top bar
 * and a drawer on narrow ones. The content column carries the language it is
 * written in, so screen readers pronounce Russian staff screens correctly.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole } = useDemoRole();
  const router = useRouter();
  const { locale, setLocale } = useStaffLocale();
  const [sidebar, setSidebar] = useSidebarState();
  const [drawer, setDrawer] = useState(false);
  const collapsed = sidebar === 'folded';

  useEffect(() => {
    if (!drawer) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [drawer]);

  // A new role starts on its own home: each role sees a different product.
  const changeRole = (next: DemoRole) => {
    setRole(next);
    setDrawer(false);
    router.push(homeFor[next]);
  };

  const sidebarProps = { role, onRoleChange: changeRole, locale, onLocaleChange: setLocale };

  return (
    <div className="min-h-screen bg-bg-base lg:flex">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-border-subtle bg-bg-elevated transition-[width] duration-200 lg:block ${
          collapsed ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        <Sidebar
          {...sidebarProps}
          collapsed={collapsed}
          onToggleCollapsed={() => setSidebar(collapsed ? 'open' : 'folded')}
        />
      </aside>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border-subtle bg-bg-base/90 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label={locale === 'ru' && isStaff(role) ? 'Открыть меню' : 'Open menu'}
          aria-expanded={drawer}
          className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border-subtle text-text-secondary"
        >
          <Bars3Icon aria-hidden="true" className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold tracking-tight text-text-primary">AI Leader ID</span>
        <RoleTile role={role} size="sm" />
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={locale === 'ru' && isStaff(role) ? 'Закрыть меню' : 'Close menu'}
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-bg-overlay/70 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border-subtle bg-bg-elevated shadow-[var(--elev)]">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label={locale === 'ru' && isStaff(role) ? 'Закрыть меню' : 'Close menu'}
              className="absolute top-4 right-3 inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:text-text-primary"
            >
              <XMarkIcon aria-hidden="true" className="h-5 w-5" />
            </button>
            <Sidebar {...sidebarProps} collapsed={false} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      ) : null}

      {/* Candidate screens set lang="en" themselves; staff screens follow the chosen language. */}
      <div lang={locale} className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
