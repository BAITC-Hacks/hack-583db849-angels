export type Score = 0 | 1 | 2 | 3 | 4 | null;
export type Confidence = 'low' | 'medium' | 'high';

const MAX = 4;

/**
 * A D.R.I.V.E. score on the 0–4 scale, or its absence.
 *
 * `null` means there was not enough verified evidence to score, and it must
 * never look like a low score: no filled segments, no number, dashed outline,
 * and the words said plainly.
 */
export function ScoreMeter({ score, confidence }: { score: Score; confidence?: Confidence }) {
  if (score === null) {
    return (
      <div className="flex items-center gap-2.5" aria-label="Insufficient evidence to score">
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: MAX }, (_, index) => (
            <span key={index} className="h-2 w-5 rounded-sm border border-dashed border-border-strong" />
          ))}
        </div>
        <span className="font-mono text-[0.68rem] tracking-wide text-text-muted uppercase">Insufficient evidence</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5" aria-label={`Score ${score} of ${MAX}`}>
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
          {confidence} confidence
        </span>
      ) : null}
    </div>
  );
}
