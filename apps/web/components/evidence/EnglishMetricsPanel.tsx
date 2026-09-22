export interface EnglishMetrics {
  wordsPerMinute: number | null;
  fillerRate: number | null;
  meanTurnLength: number | null;
  lexicalDiversity: number | null;
  grammarErrorsPer100Words: number | null;
  cefrEstimate: string | null;
}

const rows: { key: keyof EnglishMetrics; label: string; format: (value: number | string) => string }[] = [
  { key: 'cefrEstimate', label: 'CEFR estimate', format: (value) => String(value) },
  { key: 'wordsPerMinute', label: 'Words per minute', format: (value) => String(Math.round(Number(value))) },
  { key: 'meanTurnLength', label: 'Words per turn', format: (value) => Number(value).toFixed(1) },
  { key: 'lexicalDiversity', label: 'Lexical diversity', format: (value) => Number(value).toFixed(2) },
  { key: 'fillerRate', label: 'Filler words', format: (value) => `${(Number(value) * 100).toFixed(1)}%` },
  { key: 'grammarErrorsPer100Words', label: 'Grammar errors / 100 words', format: (value) => Number(value).toFixed(1) },
];

/**
 * English, measured on its own. These figures are computed by code, not by a
 * model, and they never move a D.R.I.V.E. score — the panel says so, because a
 * reader seeing both on one page would otherwise wonder.
 */
export function EnglishMetricsPanel({ metrics }: { metrics: EnglishMetrics }) {
  return (
    <section aria-labelledby="english-title" className="rounded-panel border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="english-title" className="text-sm font-semibold text-text-primary">
          English
        </h3>
        <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">Measured separately</p>
      </div>
      <p className="mt-1 text-[0.8rem] text-text-muted">
        Computed from the transcript by code. It never changes a D.R.I.V.E. score.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-border-subtle bg-border-subtle sm:grid-cols-3">
        {rows.map((row) => {
          const value = metrics[row.key];
          return (
            <div key={row.key} className="flex flex-col gap-0.5 bg-bg-base px-3 py-2.5">
              <dt className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{row.label}</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                {value === null ? '—' : row.format(value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
