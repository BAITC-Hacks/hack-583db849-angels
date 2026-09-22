'use client';

import { BeakerIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { StaffLocale } from '../../lib/i18n/staffLocale';
import { isActive, navFor, sectionLabel, type NavItem, type NavSection } from '../../lib/navigation';
import { homeFor } from '../../lib/demo/world';
import { isStaff, type DemoRole } from '../../lib/roles';
import { ThemeToggle } from '../ui/ThemeToggle';
import { LanguageSwitch } from './LanguageSwitch';
import { RoleSwitcher } from './RoleSwitcher';

const copy = {
  en: { preview: 'Preview — scripted data until the API lands', locked: 'Arrives with', collapse: 'Collapse sidebar', expand: 'Expand sidebar', synthetic: 'Synthetic data only' },
  ru: { preview: 'Превью — заготовленные данные, пока нет API', locked: 'Появится в', collapse: 'Свернуть панель', expand: 'Развернуть панель', synthetic: 'Только синтетические данные' },
};

const sections: NavSection[] = ['workspace', 'reference', 'demo'];

function Mark() {
  return (
    <svg width={28} height={28} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="16" fill="#131313" stroke="var(--line-strong)" />
      <path d="M16 18 L32 46 L48 18" stroke="var(--brand)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Item({
  item,
  locale,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem;
  locale: StaffLocale;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const label = item.label[locale];
  const Icon = item.icon;
  const base = `group relative flex items-center gap-2.5 rounded-control text-sm transition-colors ${
    collapsed ? 'h-9 justify-center' : 'h-9 px-2.5'
  }`;

  if (!item.href) {
    const note = `${copy[locale].locked} ${item.module}`;
    return (
      <div aria-disabled="true" title={collapsed ? `${label} · ${note}` : note} className={`${base} cursor-default text-text-muted`}>
        <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 opacity-70" />
        {collapsed ? null : (
          <>
            <span className="flex-1 truncate">{label}</span>
            <span className="inline-flex items-center gap-1 font-mono text-[0.58rem] tracking-wide uppercase">
              <LockClosedIcon aria-hidden="true" className="h-3 w-3" />
              {item.module}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`${base} ${
        active
          ? 'bg-bg-surface font-medium text-text-primary shadow-[var(--elev-sm)]'
          : 'text-text-secondary hover:bg-bg-surface/70 hover:text-text-primary'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink`}
    >
      {active ? <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-brand-green" /> : null}
      <Icon aria-hidden="true" className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand-ink' : ''}`} />
      {collapsed ? null : <span className="flex-1 truncate">{label}</span>}
      {item.preview && !collapsed ? (
        <BeakerIcon title={copy[locale].preview} className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      ) : null}
    </Link>
  );
}

/**
 * Navigation for everyone who uses the product: interviewer, commission, admin
 * and candidate. What it lists follows the role; staff choose English or
 * Russian here, a candidate always reads English.
 */
export function Sidebar({
  role,
  onRoleChange,
  locale,
  onLocaleChange,
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  role: DemoRole;
  onRoleChange: (role: DemoRole) => void;
  locale: StaffLocale;
  onLocaleChange: (locale: StaffLocale) => void;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const staff = isStaff(role);
  // A candidate's screens are English only, and so is the navigation around them.
  const shown: StaffLocale = staff ? locale : 'en';
  const items = navFor(role);
  const text = copy[shown];

  return (
    <div className={`flex h-full flex-col gap-5 ${collapsed ? 'px-2.5 py-4' : 'px-3.5 py-4'}`}>
      <Link
        href={homeFor[role]}
        onClick={onNavigate}
        className={`flex items-center gap-2.5 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink ${
          collapsed ? 'justify-center' : 'px-1'
        }`}
      >
        <Mark />
        {collapsed ? null : (
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-text-primary">AI Leader ID</span>
            <span className="text-[0.72rem] text-text-muted">inVision U</span>
          </span>
        )}
      </Link>

      <RoleSwitcher role={role} onChange={onRoleChange} locale={shown} collapsed={collapsed} />

      <nav aria-label="Main" className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {sections.map((section) => {
          const inSection = items.filter((item) => item.section === section);
          if (inSection.length === 0) return null;
          return (
            <div key={section} className="flex flex-col gap-0.5">
              {collapsed ? (
                <span aria-hidden="true" className="mx-auto mb-1 h-px w-6 bg-border-subtle" />
              ) : (
                <p className="mb-1 px-2.5 font-mono text-[0.58rem] tracking-[0.14em] text-text-muted uppercase">
                  {sectionLabel[section][shown]}
                </p>
              )}
              {inSection.map((item) => (
                <Item
                  key={item.id}
                  item={item}
                  locale={shown}
                  collapsed={collapsed}
                  active={isActive(item, pathname)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          );
        })}
      </nav>

      <div className={`flex flex-col gap-3 border-t border-border-subtle pt-4 ${collapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between'}`}>
          {staff && !collapsed ? <LanguageSwitch locale={locale} onChange={onLocaleChange} /> : null}
          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
            <ThemeToggle />
            {onToggleCollapsed ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? text.expand : text.collapse}
                title={collapsed ? text.expand : text.collapse}
                className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border-subtle text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary"
              >
                {collapsed ? (
                  <ChevronDoubleRightIcon aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <ChevronDoubleLeftIcon aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>
        </div>
        {collapsed ? null : (
          <p className="px-1 font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{text.synthetic}</p>
        )}
      </div>
    </div>
  );
}
