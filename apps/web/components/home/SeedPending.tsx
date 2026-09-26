'use client';

import { useCopy } from '../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: 'Nothing yet: the brief starts as soon as the candidate arrives.',
  ru: 'Пока ничего: бриф начнётся, как только кандидат появится.',
};

export function SeedPending() {
  return <span className="text-[0.78rem] text-text-muted">{useCopy(copy)}</span>;
}
