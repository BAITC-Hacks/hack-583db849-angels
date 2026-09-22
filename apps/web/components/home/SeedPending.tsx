'use client';

import { useCopy } from '../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: 'Preview data covers candidate A. B and C arrive with the seed (#4).',
  ru: 'Данные превью есть только для кандидата A. B и C появятся вместе с seed (#4).',
};

export function SeedPending() {
  return <span className="text-[0.78rem] text-text-muted">{useCopy(copy)}</span>;
}
