'use client';

import Link from 'next/link';
import { useCandidates } from '../../lib/api/candidates';
import type { WireCandidateProgress } from '../../lib/api/contract';
import { errorText } from '../../lib/api/errors';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { StatusPill, type Tone } from '../home/StatusPill';

type BriefState = NonNullable<WireCandidateProgress['brief']>['status'] | 'none';

const copy = {
  en: {
    eyebrow: 'Interviewer',
    title: 'Briefs',
    lede: 'One brief per candidate, made by itself when they arrive and again after the simulation. Open one before the interview.',
    state: { ready: 'Ready', pending: 'Being prepared', failed: 'Failed', not_started: 'Not started', none: 'Not started' },
    open: 'Open',
    loading: 'Loading the candidates…',
  },
  ru: {
    eyebrow: 'Интервьюер',
    title: 'Брифы',
    lede: 'По брифу на кандидата: он появляется сам, когда кандидат приходит, и обновляется после симуляции. Откройте перед интервью.',
    state: { ready: 'Готов', pending: 'Готовится', failed: 'Не удался', not_started: 'Не начат', none: 'Не начат' },
    open: 'Открыть',
    loading: 'Загружаем кандидатов…',
  },
};

const tones: Record<BriefState, Tone> = { ready: 'done', pending: 'active', failed: 'waiting', not_started: 'muted', none: 'muted' };

/** Every candidate's brief and where it is, from `progress.brief`; polled while one is being prepared. */
export function BriefList() {
  const text = useCopy(copy);
  const { locale } = useStaffLocale();
  const candidates = useCandidates({ poll: 'while-pending' });

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </header>

      {candidates.isError ? (
        <p role="alert" className="text-sm font-semibold text-text-primary">
          {errorText(candidates.error, locale)}
        </p>
      ) : candidates.isPending ? (
        <p className="text-sm text-text-muted" aria-live="polite">
          {text.loading}
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-panel border border-border-subtle bg-bg-surface">
          {candidates.data.map((candidate) => {
            const state: BriefState = candidate.progress?.brief?.status ?? 'none';
            return (
              <li key={candidate.candidateId} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-semibold text-text-primary">{candidate.label}</span>
                <span className="flex items-center gap-4">
                  <StatusPill tone={tones[state]}>{text.state[state]}</StatusPill>
                  <Link
                    href={`/interviewer/brief/${candidate.candidateId}`}
                    className="text-sm font-semibold text-brand-ink hover:underline"
                  >
                    {text.open}
                  </Link>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
