'use client';

import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { competencies } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { BriefEvidence, InterviewerBrief } from '../../lib/brief/types';
import { EvidenceQuote } from '../evidence/EvidenceQuote';

const copy = {
  en: {
    questions: 'Questions by competency',
    why: 'Why',
    silent: 'Asked because the application says nothing here.',
    flags: 'Inconsistencies to clarify',
    flagsNote: 'Not a verdict: two sources disagree.',
    ask: 'Ask',
    versus: 'versus',
    clarify: 'Topics to clarify',
    english: 'English gap',
    certificate: 'Certificate',
    written: 'Written answers',
    englishNote: 'Judged separately: English never moves a D.R.I.V.E. score. Start with an easy question and listen for a minute.',
  },
  ru: {
    questions: 'Вопросы по компетенциям',
    why: 'Почему',
    silent: 'Задаётся, потому что анкета об этом молчит.',
    flags: 'Противоречия, которые стоит уточнить',
    flagsNote: 'Не вердикт: два источника расходятся.',
    ask: 'Спросите',
    versus: 'против',
    clarify: 'Темы для уточнения',
    english: 'Разрыв по английскому',
    certificate: 'Сертификат',
    written: 'Письменные ответы',
    englishNote: 'Оценивается отдельно: английский никогда не влияет на баллы D.R.I.V.E. Начните с простого вопроса и послушайте минуту.',
  },
};

/** Evidence in the brief points into the sources panel beside it. */
function Quote({ item }: { item: BriefEvidence }) {
  return <EvidenceQuote quote={item.quote} source={item.source} href={`#source-${item.source.id}`} />;
}

export function BriefQuestions({ questions }: { questions: InterviewerBrief['questions'] }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  return (
    <section aria-labelledby="questions-title" className="flex flex-col gap-3">
      <h2 id="questions-title" className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
        {text.questions}
      </h2>
      {questions.map((item) => (
        <article key={item.question} className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-bg-elevated font-mono text-sm font-bold text-text-primary">
              {item.competency}
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
                {competencies[item.competency].name}
              </p>
              <p className="text-[0.95rem] font-medium text-text-primary">{item.question}</p>
              <p className="text-[0.8rem] text-text-muted">
                {text.why}: {item.why}
              </p>
            </div>
          </div>
          {item.evidence.length > 0 ? (
            <div className="flex flex-col gap-3 pl-11">
              {item.evidence.map((evidence) => (
                <Quote key={evidence.quote} item={evidence} />
              ))}
            </div>
          ) : (
            <p className="ml-11 rounded-control bg-bg-elevated px-3 py-2 text-[0.8rem] text-text-secondary">{text.silent}</p>
          )}
        </article>
      ))}
    </section>
  );
}

export function BriefFlags({ flags }: { flags: InterviewerBrief['flags'] }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  return (
    <section aria-labelledby="flags-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="flags-title" className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
          {text.flags}
        </h2>
        <p className="text-[0.75rem] text-text-muted">{text.flagsNote}</p>
      </div>
      {flags.map((flag) => (
        <article key={flag.title} className="flex flex-col gap-3 rounded-panel border border-status-flag/35 bg-bg-surface p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <ArrowsRightLeftIcon aria-hidden="true" className="h-4 w-4 text-status-flag" />
            {flag.title}
          </h3>
          <div className="grid items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
            <Quote item={flag.sources[0]} />
            <span className="self-center font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">{text.versus}</span>
            <Quote item={flag.sources[1]} />
          </div>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{text.ask}:</span> {flag.ask}
          </p>
        </article>
      ))}
    </section>
  );
}

export function BriefClarify({ items }: { items: InterviewerBrief['clarify'] }) {
  const { locale } = useStaffLocale();

  return (
    <section aria-labelledby="clarify-title" className="rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h2 id="clarify-title" className="text-sm font-semibold text-text-primary">
        {copy[locale].clarify}
      </h2>
      <ul className="mt-3 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.topic} className="flex flex-col gap-2">
            <p className="text-sm text-text-primary">{item.topic}</p>
            {item.evidence.map((evidence) => (
              <Quote key={evidence.quote} item={evidence} />
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BriefEnglish({ english }: { english: InterviewerBrief['english'] }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  return (
    <section aria-labelledby="english-gap-title" className="rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h2 id="english-gap-title" className="text-sm font-semibold text-text-primary">
        {text.english}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-border-subtle bg-border-subtle">
        <div className="flex flex-col gap-0.5 bg-bg-base px-3 py-2.5">
          <dt className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{text.certificate}</dt>
          <dd className="font-mono text-sm font-semibold text-text-primary">
            {english.certificate} · {english.certificateCefr}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 bg-bg-base px-3 py-2.5">
          <dt className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{text.written}</dt>
          <dd className="font-mono text-sm font-semibold text-text-primary">{english.writtenCefr}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[0.8rem] text-text-secondary">{english.basis}</p>
      <p className="mt-2 text-[0.75rem] text-text-muted">{text.englishNote}</p>
    </section>
  );
}
