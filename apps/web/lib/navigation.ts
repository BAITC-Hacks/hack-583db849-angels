import {
  BuildingLibraryIcon,
  HomeIcon,
  PresentationChartBarIcon,
  ChartBarSquareIcon,
  ChatBubbleBottomCenterTextIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  SwatchIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import type { Copy } from './i18n/staffLocale';
import type { DemoRole } from './roles';

export type NavSection = 'workspace' | 'reference' | 'demo';

export interface NavItem {
  id: string;
  section: NavSection;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: Copy<string>;
  roles: DemoRole[];
  /** Absent while the item's slice has not landed; the item then shows as locked. */
  href?: string;
  /** Paths that count as this item when they differ from `href`. */
  match?: string;
  /** The screen runs on scripted preview data until its API lands. */
  preview?: boolean;
  module?: 'M1' | 'M2' | 'M3' | 'M4' | 'M5';
}

/**
 * Every place the sidebar can take someone, and who may go there.
 *
 * The role lists carry the product's rules, not just tidiness: an interviewer
 * has no simulation reports, because they score blind; a candidate sees only
 * their own simulation and feedback. The server enforces the same with API key
 * roles — hiding a link is not authorization.
 */
export const navItems: NavItem[] = [
  {
    id: 'interviewer-home',
    section: 'workspace',
    icon: HomeIcon,
    label: { en: 'My interviews', ru: 'Мои интервью' },
    roles: ['interviewer'],
    href: '/interviewer',
  },
  {
    id: 'commission-home',
    section: 'workspace',
    icon: UsersIcon,
    label: { en: 'In review', ru: 'На рассмотрении' },
    roles: ['commission'],
    href: '/commission',
  },
  {
    id: 'admin-home',
    section: 'workspace',
    icon: HomeIcon,
    label: { en: 'System', ru: 'Система' },
    roles: ['admin'],
    href: '/admin',
  },
  {
    id: 'candidate-home',
    section: 'workspace',
    icon: HomeIcon,
    label: { en: 'Home', ru: 'Home' },
    roles: ['candidate'],
    href: '/candidate',
  },
  {
    id: 'briefs',
    section: 'workspace',
    icon: DocumentTextIcon,
    label: { en: 'Briefs', ru: 'Брифы' },
    roles: ['interviewer', 'admin'],
    href: '/interviewer/brief/00000000-0000-4000-8000-00000000000a',
    match: '/interviewer/brief',
    preview: true,
    module: 'M1',
  },
  {
    id: 'interviews',
    section: 'workspace',
    icon: ClipboardDocumentCheckIcon,
    label: { en: 'Interviews', ru: 'Интервью' },
    roles: ['interviewer', 'admin'],
    href: '/interviewer/interview/preview',
    match: '/interviewer/interview',
    preview: true,
    module: 'M4',
  },
  {
    id: 'reports',
    section: 'workspace',
    icon: ChartBarSquareIcon,
    label: { en: 'Simulation reports', ru: 'Отчёты симуляций' },
    roles: ['commission', 'admin'],
    href: '/commission/simulation-report/preview',
    match: '/commission/simulation-report',
    preview: true,
    module: 'M3',
  },
  {
    id: 'quality',
    section: 'workspace',
    icon: ShieldCheckIcon,
    label: { en: 'Quality guard', ru: 'Контроль качества' },
    roles: ['commission', 'admin'],
    href: '/commission/quality-guard',
    preview: true,
    module: 'M5',
  },
  {
    id: 'simulation',
    section: 'workspace',
    icon: ChatBubbleLeftRightIcon,
    label: { en: 'My simulation', ru: 'My simulation' },
    roles: ['candidate'],
    href: '/simulation/preview',
    match: '/simulation',
    preview: true,
    module: 'M2',
  },
  {
    id: 'feedback',
    section: 'workspace',
    icon: ChatBubbleBottomCenterTextIcon,
    label: { en: 'My feedback', ru: 'My feedback' },
    roles: ['candidate'],
    href: '/feedback/preview',
    match: '/feedback',
    preview: true,
    module: 'M3',
  },
  {
    id: 'overview',
    section: 'reference',
    icon: PresentationChartBarIcon,
    label: { en: 'Demo overview', ru: 'Обзор демо' },
    roles: ['admin'],
    href: '/demo/candidates',
  },
  {
    id: 'kit',
    section: 'reference',
    icon: SwatchIcon,
    label: { en: 'Evidence components', ru: 'Компоненты доказательств' },
    roles: ['admin'],
    href: '/demo/kit',
  },
  {
    id: 'stand',
    section: 'demo',
    icon: BuildingLibraryIcon,
    label: { en: 'Platform stand', ru: 'Стенд платформы' },
    roles: ['interviewer', 'commission', 'admin', 'candidate'],
    href: '/stand',
  },
];

export const sectionLabel: Record<NavSection, Copy<string>> = {
  workspace: { en: 'Workspace', ru: 'Работа' },
  reference: { en: 'Reference', ru: 'Справочник' },
  demo: { en: 'Demo', ru: 'Демо' },
};

export function navFor(role: DemoRole): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role));
}

/** The item a path belongs to, so the sidebar can mark where the reader is. */
export function isActive(item: NavItem, pathname: string): boolean {
  const base = item.match ?? item.href;
  return Boolean(base && (pathname === base || pathname.startsWith(`${base}/`)));
}
