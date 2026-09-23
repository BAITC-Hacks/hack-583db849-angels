import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeItemId, isActive, navFor, navItems } from '../lib/navigation';

const ids = (role: Parameters<typeof navFor>[0]) => navFor(role).map((item) => item.id);

/** Resolves a path to a page file, allowing one dynamic segment per level. */
function routeExists(href: string): boolean {
  const roots = [join(__dirname, '../app'), join(__dirname, '../app/(product)')];
  return roots.some((root) => {
    let dir = root;
    for (const segment of href.split('/').filter(Boolean)) {
      if (existsSync(join(dir, segment))) dir = join(dir, segment);
      else {
        const dynamic = readdirSync(dir).find((name) => name.startsWith('['));
        if (!dynamic) return false;
        dir = join(dir, dynamic);
      }
    }
    return existsSync(join(dir, 'page.tsx'));
  });
}

describe('navigation by role', () => {
  it('gives the interviewer no simulation reports: they score blind', () => {
    expect(ids('interviewer')).not.toContain('reports');
    expect(ids('interviewer')).toEqual(expect.arrayContaining(['interviewer-home', 'briefs', 'interviews']));
  });

  it('gives the commission the reports and the quality guard, not the interview form', () => {
    expect(ids('commission')).toEqual(expect.arrayContaining(['commission-home', 'reports', 'quality']));
    expect(ids('commission')).not.toContain('interviews');
  });

  it('shows a candidate only their own screens', () => {
    expect(ids('candidate')).toEqual(['candidate-home', 'simulation', 'feedback', 'stand']);
  });

  it('shows the admin everything', () => {
    expect(ids('admin').sort()).toEqual(navItems.filter((item) => item.roles.includes('admin')).map((i) => i.id).sort());
    expect(ids('admin')).toEqual(expect.arrayContaining(['admin-home', 'briefs', 'interviews', 'reports', 'quality', 'overview', 'kit']));
  });

  it('gives every role its own home', () => {
    const homes = (['interviewer', 'commission', 'admin', 'candidate'] as const).map((role) => navFor(role)[0].href);
    expect(new Set(homes).size).toBe(4);
  });

  it('keeps candidate-only items in English in both languages', () => {
    for (const item of navItems.filter((entry) => entry.roles.every((role) => role === 'candidate'))) {
      expect(item.label.ru).toBe(item.label.en);
    }
  });

  it('links only to pages that exist, and locks the rest', () => {
    for (const item of navItems) {
      if (item.href) expect(routeExists(item.href), item.href).toBe(true);
      else expect(item.module, item.id).toBeDefined();
    }
  });

  it('marks the simulation active on any session', () => {
    const simulation = navItems.find((item) => item.id === 'simulation')!;
    expect(isActive(simulation, '/simulation/abc')).toBe(true);
    expect(isActive(simulation, '/demo/candidates')).toBe(false);
  });
});

describe('the item the sidebar marks', () => {
  // Every role's home contains its other screens, so a prefix rule alone
  // lit up two items at once — the home and the screen the reader was on.
  const cases: [Parameters<typeof navFor>[0], string, string][] = [
    ['interviewer', '/interviewer', 'interviewer-home'],
    ['interviewer', '/interviewer/brief/00000000-0000-4000-8000-00000000000a', 'briefs'],
    ['interviewer', '/interviewer/interview/preview', 'interviews'],
    ['commission', '/commission', 'commission-home'],
    ['commission', '/commission/quality-guard', 'quality'],
    ['commission', '/commission/simulation-report/preview', 'reports'],
    ['admin', '/admin', 'admin-home'],
    ['admin', '/admin/scenarios', 'scenarios'],
    ['candidate', '/candidate', 'candidate-home'],
  ];

  it.each(cases)('as %s on %s marks only %s', (role, pathname, expected) => {
    const items = navFor(role);
    expect(activeItemId(items, pathname)).toBe(expected);
    expect(items.filter((item) => item.id === activeItemId(items, pathname))).toHaveLength(1);
  });

  it('marks nothing on a path no item owns', () => {
    expect(activeItemId(navFor('commission'), '/somewhere-else')).toBeNull();
  });
});
