'use client';

import { errorText } from '../../lib/api/errors';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: { body: 'The steps that live in the API may be out of date until it answers again.' },
  ru: { body: 'Шаги, которые хранит API, могут быть неактуальны, пока он снова не ответит.' },
};

/** Said on a home when the API cannot be read, rather than showing every step as not started. */
export function ApiUnavailable({ error }: { error: unknown }) {
  const text = useCopy(copy);
  const { locale } = useStaffLocale();
  if (!error) return null;
  return (
    <p role="alert" className="rounded-control border border-status-flag/40 bg-bg-surface px-4 py-2.5 text-sm text-text-primary">
      {errorText(error, locale)} {text.body}
    </p>
  );
}
