'use client';

import { useCopy } from '../../lib/i18n/StaffLocaleProvider';

export type Score = 0 | 1 | 2 | 3 | 4 | null;
export type Confidence = 'low' | 'medium' | 'high';

const MAX = 4;

const copy = {
  en: {
    insufficient: 'Insufficient evidence',
    insufficientLabel: 'Insufficient evidence to score',
    score: (score: number) => `Score ${score} of ${MAX}`,
    confidence: { low: 'low confidence', medium: 'medium confidence', high: 'high confidence' },
  },
  ru: {
    insufficient: 'Недостаточно доказательств',
    insufficientLabel: 'Недостаточно доказательств для оценки',
    score: (score: number) => `Балл ${score} из ${MAX}`,
    confidence: { low: 'уверенность низкая', medium: 'уверенность средняя', high: 'уверенность высокая' },
  },
};

/**
 * A D.R.I.V.E. score on the 0–4 scale, or its absence.
 *
 * `null` means there was not enough verified evidence to score, and it must
 * never look like a low score: no filled segments, no number, dashed outline,
 * and the words said plainly.
 */
export function ScoreMeter({ score, confidence }: { score: Score; confidence?: Confidence }) {
  const text = useCopy(copy);

  if (score === null) {
    return (
      <div className="flex items-center gap-2.5" aria-label={text.insufficientLabel}>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: MAX }, (_, index) => (
            <span key={index} className="h-2 w-5 rounded-sm border border-dashed border-border-strong" />
          ))}
        </div>
        <span className="font-mono text-[0.68rem] tracking-wide text-text-muted uppercase">{text.insufficient}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5" aria-label={text.score(score)}>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: MAX }, (_, index) => (
          <span key={index} className={`h-2 w-5 rounded-sm ${index < score ? 'bg-brand-green' : 'bg-border-subtle'}`} />
        ))}
      </div>
      <span className="font-mono text-[0.8rem] font-semibold tabular-nums text-text-primary">
        {score} / {MAX}
      </span>
      {confidence ? (
        <span className="rounded-full border border-border-subtle px-2 py-0.5 font-mono text-[0.58rem] tracking-wide text-text-muted uppercase">
          {text.confidence[confidence]}
        </span>
      ) : null}
    </div>
  );
}
