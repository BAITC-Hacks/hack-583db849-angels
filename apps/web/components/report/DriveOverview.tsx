'use client';

import { competencies } from '../../lib/drive';
import { useCopy } from '../../lib/i18n/StaffLocaleProvider';
import type { SimulationReport } from '../../lib/report/types';
import { ScoreMeter } from '../evidence/ScoreMeter';

const copy = {
  en: { title: 'D.R.I.V.E. at a glance', note: 'No total and no ranking: each competency stands on its own evidence.' },
  ru: { title: 'D.R.I.V.E. коротко', note: 'Нет общего балла и рейтинга: каждая компетенция держится на своих доказательствах.' },
};

/**
 * One line per competency, each linking to its evidence. Deliberately no sum
 * or average: a single number would invite ranking candidates, which the
 * product does not do.
 */
export function DriveOverview({ scores }: { scores: SimulationReport['scores'] }) {
  const text = useCopy(copy);

  return (
    <section aria-labelledby="overview-title" className="rounded-panel border border-border-subtle bg-bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle px-5 py-3">
        <h2 id="overview-title" className="text-sm font-semibold text-text-primary">
          {text.title}
        </h2>
        <p className="text-[0.75rem] text-text-muted">{text.note}</p>
      </header>
      <ul className="divide-y divide-border-subtle">
        {scores.map((item) => {
          const supported = item.score !== null && item.evidence.length > 0;
          return (
            <li key={item.competency}>
              <a
                href={`#competency-${item.competency}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-bg-elevated"
              >
                <span className="flex items-center gap-3">
                  <span className="w-4 font-mono text-sm font-bold text-text-primary">{item.competency}</span>
                  <span className="text-sm text-text-secondary">{competencies[item.competency].name}</span>
                </span>
                <ScoreMeter score={supported ? item.score : null} />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
