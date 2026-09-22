'use client';

import { useCopy } from '../../lib/i18n/StaffLocaleProvider';
import type { InterviewerBrief } from '../../lib/brief/types';

const copy = {
  en: { title: 'What the brief is built from', hint: 'The candidate’s own words, untranslated.', application: 'Application', test: 'Test' },
  ru: { title: 'Из чего собран бриф', hint: 'Слова кандидата, без перевода.', application: 'Анкета', test: 'Тест' },
};

const item = 'scroll-mt-6 rounded-control px-3 py-2 transition-colors target:bg-chip-review target:ring-1 target:ring-status-evidence';

/**
 * The application answers and test responses the brief quotes. Every quote's
 * "Show in context" lands here and lights up its source.
 */
export function SourcesPanel({ application, test }: Pick<InterviewerBrief, 'application' | 'test'>) {
  const text = useCopy(copy);

  return (
    <section aria-labelledby="sources-title" className="flex max-h-[calc(100vh-3rem)] flex-col rounded-panel border border-border-subtle bg-bg-surface">
      <header className="border-b border-border-subtle px-5 py-3">
        <h2 id="sources-title" className="text-sm font-semibold text-text-primary">
          {text.title}
        </h2>
        <p className="text-[0.75rem] text-text-muted">{text.hint}</p>
      </header>
      <div className="flex flex-col gap-4 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          <p className="px-3 font-mono text-[0.58rem] tracking-[0.14em] text-text-muted uppercase">{text.application}</p>
          {application.map((answer) => (
            <div key={answer.fieldId} id={`source-${answer.fieldId}`} className={item}>
              <p className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted">{answer.fieldId}</p>
              <p lang="en" className="text-[0.75rem] font-medium text-text-secondary">
                {answer.question}
              </p>
              <p lang="en" className="mt-1 text-[0.82rem] leading-relaxed text-text-primary">
                {answer.answer}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <p className="px-3 font-mono text-[0.58rem] tracking-[0.14em] text-text-muted uppercase">{text.test}</p>
          {test.map((response) => (
            <div key={response.itemId} id={`source-${response.itemId}`} className={item}>
              <p className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted">{response.itemId}</p>
              <p lang="en" className="mt-0.5 text-[0.82rem] leading-relaxed text-text-primary">
                {response.response}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
