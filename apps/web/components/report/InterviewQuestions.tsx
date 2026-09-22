'use client';

import { useCopy } from '../../lib/i18n/StaffLocaleProvider';
import type { SimulationReport } from '../../lib/report/types';

const copy = {
  en: { title: 'Questions for the live interview', lede: 'Aimed at what the simulation left open.', why: 'Why' },
  ru: { title: 'Вопросы для живого интервью', lede: 'Нацелены на то, что симуляция оставила открытым.', why: 'Почему' },
};

export function InterviewQuestions({ questions }: { questions: SimulationReport['interviewQuestions'] }) {
  const text = useCopy(copy);

  return (
    <section aria-labelledby="questions-title" className="rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h2 id="questions-title" className="text-sm font-semibold text-text-primary">
        {text.title}
      </h2>
      <p className="text-[0.75rem] text-text-muted">{text.lede}</p>
      <ol className="mt-4 flex flex-col gap-4">
        {questions.map((item, index) => (
          <li key={item.question} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-bg-elevated font-mono text-[0.68rem] font-bold text-text-primary">
              {item.competency}
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-text-primary">
                <span className="mr-1.5 font-mono text-[0.68rem] text-text-muted">{index + 1}.</span>
                {item.question}
              </p>
              <p className="text-[0.75rem] text-text-muted">
                {text.why}: {item.reason}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
