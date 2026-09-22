'use client';

import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import type { StaffLocale } from '../../lib/i18n/staffLocale';
import { demoRoles, roleMeta, type DemoRole } from '../../lib/roles';

const copy = {
  en: { label: 'Demo role', choose: 'Switch role' },
  ru: { label: 'Роль в демо', choose: 'Сменить роль' },
};

function RoleTile({ role, size = 'md' }: { role: DemoRole; size?: 'sm' | 'md' }) {
  const meta = roleMeta[role];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-control font-mono font-bold text-chip-ink ${meta.tile} ${
        size === 'sm' ? 'h-7 w-7 text-[0.6rem]' : 'h-8 w-8 text-[0.65rem]'
      }`}
    >
      {meta.short}
    </span>
  );
}

/**
 * Lets the presenter show the product through each person's eyes. In
 * production the API key fixes the role and there is no such control.
 */
export function RoleSwitcher({
  role,
  onChange,
  locale,
  collapsed,
}: {
  role: DemoRole;
  onChange: (role: DemoRole) => void;
  locale: StaffLocale;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const text = copy[locale];

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const current = roleMeta[role].copy[locale];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${text.choose}: ${current.name}`}
        title={collapsed ? `${text.label}: ${current.name}` : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-2.5 rounded-control border border-border-subtle bg-bg-surface text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink ${
          collapsed ? 'justify-center p-1.5' : 'p-2'
        }`}
      >
        <RoleTile role={role} />
        {collapsed ? null : (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono text-[0.55rem] tracking-[0.12em] text-text-muted uppercase">{text.label}</span>
              <span className="truncate text-sm font-semibold text-text-primary">{current.name}</span>
            </span>
            <ChevronUpDownIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" />
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={text.choose}
          className={`absolute z-50 mt-1.5 w-64 rounded-panel border border-border-subtle bg-bg-surface p-1.5 shadow-[var(--elev)] ${
            collapsed ? 'left-0' : 'inset-x-0 w-auto'
          }`}
        >
          {demoRoles.map((option) => {
            const meta = roleMeta[option].copy[locale];
            const selected = option === role;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-control p-2 text-left transition-colors hover:bg-bg-elevated ${
                  selected ? 'bg-bg-elevated' : ''
                }`}
              >
                <RoleTile role={option} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-text-primary">{meta.name}</span>
                  <span className="text-[0.72rem] leading-snug text-text-muted">{meta.caption}</span>
                </span>
                {selected ? <CheckIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-ink" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export { RoleTile };
