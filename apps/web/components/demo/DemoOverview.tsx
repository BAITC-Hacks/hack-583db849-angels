'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { candidateByCode, useCandidates } from '../../lib/api/candidates';
import { errorText } from '../../lib/api/errors';
import { pathSteps, stories } from '../../lib/demo/story';
import type { CandidateCode } from '../../lib/home/types';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: {
    eyebrow: 'Demo',
    title: 'Choose a candidate',
    lede: 'Three synthetic candidates, each built to show one thing. None of them is a real person, and nothing on these screens accepts or rejects anyone: the decision stays with the interviewer and the commission.',
    path: 'The path',
    candidates: 'Candidates',
    candidate: 'Candidate',
    watchFor: 'What to point at',
    start: 'Start',
    loading: 'Loading the candidates…',
  },
  ru: {
    eyebrow: 'Демо',
    title: 'Выберите кандидата',
    lede: 'Три синтетических кандидата, каждый показывает что-то одно. Ни один из них не реальный человек, и ни один экран здесь никого не принимает и не отклоняет: решение остаётся за интервьюером и комиссией.',
    path: 'Путь',
    candidates: 'Кандидаты',
    candidate: 'Кандидат',
    watchFor: 'На что обратить внимание',
    start: 'Начать',
    loading: 'Загружаем кандидатов…',
  },
};

/**
 * Where the demo starts: pick one of three synthetic candidates and follow
 * them through the brief, the simulation, the report, the interview draft
 * and the quality guard — every link by the candidate's own id from the API.
 */
export function DemoOverview() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const candidates = useCandidates();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10">
      <section className="flex flex-col gap-2">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-2xl text-sm text-text-secondary">{text.lede}</p>
      </section>

      <section aria-labelledby="path-title" className="flex flex-col gap-3">
        <h2 id="path-title" className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
          {text.path}
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-5">
          {pathSteps.map((step, index) => (
            <li key={step.module} className="flex bg-bg-surface">
              <Link
                href={step.href}
                className="flex flex-1 flex-col gap-1.5 p-4 transition-colors hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ink"
              >
                <span className="font-mono text-[0.68rem] tracking-[0.12em] text-brand-ink">
                  0{index + 1} · {step.module}
                </span>
                <p className="text-sm font-semibold text-text-primary">{step.copy[locale].title}</p>
                <p className="text-[0.8rem] text-text-secondary">{step.copy[locale].note}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="candidates-title" className="flex flex-col gap-3">
        <h2 id="candidates-title" className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
          {text.candidates}
        </h2>
        {candidates.isError ? (
          <p role="alert" className="text-sm text-text-primary">{errorText(candidates.error, locale)}</p>
        ) : null}
        <ul className="grid gap-4 lg:grid-cols-3">
          {(['A', 'B', 'C'] as CandidateCode[]).map((code) => {
            const content = stories[code][locale];
            const candidate = candidateByCode(candidates.data, code);
            return (
              <li key={code} className="flex flex-col gap-4 rounded-panel border border-border-subtle bg-bg-surface p-5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft font-mono text-lg font-bold text-brand-ink"
                  >
                    {code}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
                      {text.candidate} {code}
                    </p>
                    <h3 className="text-sm font-semibold text-text-primary">{content.headline}</h3>
                  </div>
                </div>

                <p className="text-sm text-text-secondary">{content.summary}</p>

                <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
                  <p className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{text.watchFor}</p>
                  <ul className="flex flex-col gap-1">
                    {content.watchFor.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[0.8rem] text-text-secondary">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-green" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                  <span className="font-mono text-[0.6rem] text-text-muted">{candidate?.candidateId.slice(-12) ?? ''}</span>
                  {candidate ? (
                    <Link
                      href={`/interviewer/brief/${candidate.candidateId}`}
                      className="group inline-flex items-center gap-1.5 rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
                    >
                      {text.start}: {pathSteps[0].copy[locale].title}
                      <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  ) : (
                    <span className="text-[0.8rem] text-text-muted">{candidates.isPending ? text.loading : ''}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
