'use client';

import { errorText } from '../../lib/api/errors';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { useScenarioPool } from '../../lib/scenarios/queries';
import { ScenarioPool } from './ScenarioPool';

const copy = {
  en: { loading: 'Loading the pool…' },
  ru: { loading: 'Загружаем пул…' },
};

/** The pool from `GET /v1/scenarios`: titles, status, competencies and counts — never the story. */
export function ScenarioPoolLive() {
  const text = useCopy(copy);
  const { locale } = useStaffLocale();
  const pool = useScenarioPool();

  if (pool.isPending) return <p className="text-sm text-text-muted" aria-live="polite">{text.loading}</p>;
  if (pool.isError) return <p role="alert" className="text-sm text-text-primary">{errorText(pool.error, locale)}</p>;
  return <ScenarioPool scenarios={pool.data} />;
}
