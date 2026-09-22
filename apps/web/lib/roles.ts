import { createPreference } from './preference';
import type { Copy } from './i18n/staffLocale';

/**
 * Who is looking at the screen. In production the API key decides and the
 * server enforces it; in the demo the presenter switches roles to show what
 * each person sees — and, as importantly, what they do not.
 */
export type DemoRole = 'interviewer' | 'commission' | 'admin' | 'candidate';

export const demoRoles: DemoRole[] = ['interviewer', 'commission', 'admin', 'candidate'];

/** Staff read the interface in English or Russian; a candidate always reads English. */
export function isStaff(role: DemoRole): boolean {
  return role !== 'candidate';
}

export const roleMeta: Record<DemoRole, { short: string; tile: string; copy: Copy<{ name: string; caption: string }> }> = {
  interviewer: {
    short: 'IN',
    tile: 'bg-chip-sky',
    copy: {
      en: { name: 'Interviewer', caption: 'Prepares, interviews, scores blind' },
      ru: { name: 'Интервьюер', caption: 'Готовится, проводит интервью, оценивает вслепую' },
    },
  },
  commission: {
    short: 'CO',
    tile: 'bg-chip-review',
    copy: {
      en: { name: 'Commission', caption: 'Reviews the evidence and decides' },
      ru: { name: 'Комиссия', caption: 'Изучает доказательства и принимает решение' },
    },
  },
  admin: {
    short: 'AD',
    tile: 'bg-chip-model',
    copy: {
      en: { name: 'Admin', caption: 'Sees every screen' },
      ru: { name: 'Админ', caption: 'Видит все экраны' },
    },
  },
  candidate: {
    short: 'CA',
    tile: 'bg-brand-soft',
    copy: {
      en: { name: 'Candidate', caption: 'Plays the simulation, gets feedback' },
      ru: { name: 'Кандидат', caption: 'Проходит симуляцию, получает отзыв' },
    },
  },
};

export const useDemoRole = createPreference<DemoRole>('invision-demo-role', 'interviewer', demoRoles);
