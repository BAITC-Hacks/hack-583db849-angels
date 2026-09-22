'use client';

import { competencies, type Competency } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { EvidenceQuote, type EvidenceSource } from './EvidenceQuote';
import { ScoreMeter, type Confidence, type Score } from './ScoreMeter';

export interface CompetencyScoreProps {
  competency: Competency;
  score: Score;
  confidence?: Confidence;
  rationale?: string;
  evidence: { quote: string; source: EvidenceSource; href?: string }[];
}

/**
 * One D.R.I.V.E. competency: the score, why, and the quotes behind it.
 *
 * A score arriving without evidence is shown as insufficient evidence rather
 * than trusted. The service should never send one — docs/SPEC.md forbids it —
 * but if it does, the screen must not present an unsupported number.
 */
const noEvidence = {
  en: 'There is not enough verified evidence to score this. It is a question for the live interview, not a low mark.',
  ru: 'Для оценки не хватает проверенных доказательств. Это вопрос для живого интервью, а не низкая оценка.',
};

export function CompetencyScore({ competency, score, confidence, rationale, evidence }: CompetencyScoreProps) {
  const { locale } = useStaffLocale();
  const { name, looksFor } = competencies[competency];
  const supported = score !== null && evidence.length > 0;
  const shown: Score = supported ? score : null;

  return (
    <article className="@container flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
      {/* Laid out by the card's own width, so it also fits a narrow side column. */}
      <header className="flex flex-col gap-3 @lg:flex-row @lg:items-start @lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-bg-elevated font-mono text-sm font-bold text-text-primary"
          >
            {competency}
          </span>
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-text-primary">{name}</h3>
            <p className="text-[0.8rem] text-text-muted">{looksFor[locale]}</p>
          </div>
        </div>
        <div className="shrink-0">
          <ScoreMeter score={shown} confidence={supported ? confidence : undefined} />
        </div>
      </header>

      {supported ? (
        <>
          {rationale ? <p className="text-sm text-text-secondary">{rationale}</p> : null}
          <div className="flex flex-col gap-3">
            {evidence.map((item) => (
              <EvidenceQuote key={`${item.source.kind}:${item.source.id}:${item.quote}`} {...item} />
            ))}
          </div>
        </>
      ) : (
        <p className="rounded-control bg-bg-elevated px-3 py-2 text-[0.8rem] text-text-secondary">
          {noEvidence[locale]}
        </p>
      )}
    </article>
  );
}
