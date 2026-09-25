'use client';

import { useCopy } from '../../lib/i18n/StaffLocaleProvider';
import { LOW_RECOGNITION_CONFIDENCE } from '../../lib/report/types';
import type { SimulationTurn } from '../../lib/simulation/types';

const copy = {
  en: {
    title: 'Transcript',
    hint: 'Quotes in the report link here.',
    candidate: 'Candidate',
    unsure: 'Recogniser unsure — check the recording before relying on these words',
  },
  ru: {
    title: 'Транскрипт',
    hint: 'Сюда ведут ссылки из цитат отчёта.',
    candidate: 'Кандидат',
    unsure: 'Распознавание неуверенное — сверьтесь с записью, прежде чем опираться на эти слова',
  },
};

/**
 * The whole conversation, turn by turn, so every quote can be read in its
 * context. A linked turn lights up when a quote's "Show in context" jumps to
 * it. The words are the candidate's own and stay in English.
 */
export function ReportTranscript({
  turns,
  characterName,
  candidateCode,
}: {
  turns: SimulationTurn[];
  characterName: string;
  candidateCode: string;
}) {
  const text = useCopy(copy);

  return (
    <section aria-labelledby="transcript-title" className="flex max-h-[calc(100vh-3rem)] flex-col rounded-panel border border-border-subtle bg-bg-surface">
      <header className="border-b border-border-subtle px-5 py-3">
        <h2 id="transcript-title" className="text-sm font-semibold text-text-primary">
          {text.title}
        </h2>
        <p className="text-[0.75rem] text-text-muted">{text.hint}</p>
      </header>
      <ol className="flex flex-col gap-1 overflow-y-auto p-3" lang="en">
        {turns.map((turn) => {
          const candidate = turn.speaker === 'candidate';
          const unsure =
            candidate && typeof turn.recognitionConfidence === 'number' && turn.recognitionConfidence < LOW_RECOGNITION_CONFIDENCE;
          return (
            <li
              key={turn.turnId}
              id={turn.turnId}
              className="scroll-mt-3 rounded-control px-3 py-2 transition-colors target:bg-chip-review target:ring-1 target:ring-status-evidence"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`font-mono text-[0.58rem] tracking-[0.12em] uppercase ${
                    candidate ? 'text-brand-ink' : 'text-text-muted'
                  }`}
                >
                  {candidate ? `${text.candidate} ${candidateCode}` : characterName}
                </span>
                <span className="font-mono text-[0.58rem] text-text-muted">{turn.turnId.replace('turn_', '#')}</span>
              </div>
              <p className={`mt-0.5 text-[0.82rem] leading-relaxed ${candidate ? 'text-text-primary' : 'text-text-secondary'}`}>
                {turn.text}
              </p>
              {unsure ? (
                <p className="mt-1 text-[0.7rem] text-status-flag">
                  {text.unsure} ({turn.recognitionConfidence?.toFixed(2)})
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
