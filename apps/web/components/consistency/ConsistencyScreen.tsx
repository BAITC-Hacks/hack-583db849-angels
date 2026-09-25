'use client';

import Link from 'next/link';
import { candidateById, useCandidates } from '../../lib/api/candidates';
import { ApiError } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useConsistency } from '../../lib/consistency/queries';
import type { ConsistencyReport } from '../../lib/consistency/types';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { ConsistencyComparison } from './ConsistencyComparison';
import { ConsistencyGate } from './ConsistencyGate';

const copy = {
  en: {
    eyebrow: 'Consistency',
    lede: 'What the candidate said about themselves, against what was measured and what the interview showed. Signals with their evidence — no score is given here, and no decision is made here.',
    privacy: 'Built from answers, speech measures and the interview transcript. Quotes are never translated.',
    loading: 'Opening the comparison…',
    unknown: 'Candidate not found.',
    back: 'Back to the candidates',
    pending: 'What the interview showed is being prepared. This page adds it as soon as it is ready.',
    failed: 'What the interview showed could not be prepared. The before stage is below.',
    waiting: 'The interview has no transcript yet, so there is only the before stage so far.',
    noBrief: 'There is no brief yet, so nothing was compared before the interview.',
  },
  ru: {
    eyebrow: 'Сверка данных',
    lede: 'Что кандидат сказал о себе — против того, что измерено и что показало интервью. Сигналы с доказательствами: баллов здесь нет и решение здесь не принимается.',
    privacy: 'Собрано из ответов, метрик речи и расшифровки интервью. Цитаты не переводятся.',
    loading: 'Открываем сверку…',
    unknown: 'Кандидат не найден.',
    back: 'К кандидатам',
    pending: 'Итог интервью готовится. Страница добавит его, как только он будет готов.',
    failed: 'Итог интервью подготовить не удалось. Ниже — стадия до интервью.',
    waiting: 'У интервью ещё нет расшифровки, поэтому пока есть только стадия до интервью.',
    noBrief: 'Брифа ещё нет, поэтому до интервью ничего не сверялось.',
  },
};

const empty = (candidateId: string, stage: 'before' | 'after'): ConsistencyReport => ({ candidateId, stage, createdAt: '', items: [] });

/**
 * C: the commission's side of the consistency layer, from the API. The brief
 * showed the before stage to the interviewer; this shows both stages
 * together, so the panel can see what the interview settled and what it
 * left open. The after stage stays locked — and out of the network — until
 * the interviewer has saved their own scores.
 */
export function ConsistencyScreen({ candidateId }: { candidateId: string }) {
  const text = useCopy(copy);
  const { locale } = useStaffLocale();
  const candidates = useCandidates({ poll: 'while-pending' });
  const candidate = candidateById(candidates.data, candidateId);
  const progress = candidate?.progress;
  const afterStatus = progress?.consistency?.after ?? null;
  const locked = !progress?.interview?.scoresSaved || afterStatus === 'locked';
  const before = useConsistency(candidateId, 'before', { enabled: Boolean(candidate) });
  const after = useConsistency(candidateId, 'after', { enabled: !locked && afterStatus === 'ready' });

  if (candidates.isPending) return <p className="px-5 py-16 text-center text-sm text-text-muted" aria-live="polite">{text.loading}</p>;
  if (candidates.isError || !candidate) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-16 text-center">
        <p role="alert" className="text-sm font-semibold text-text-primary">{candidates.isError ? errorText(candidates.error, locale) : text.unknown}</p>
        <Link href="/commission" className="text-sm font-semibold text-brand-ink hover:underline">{text.back}</Link>
      </main>
    );
  }

  const noBrief = before.error instanceof ApiError && before.error.code === 'CONSISTENCY_NOT_FOUND';
  const note = afterStatus === 'pending' ? text.pending : afterStatus === 'failed' ? text.failed : afterStatus === null ? text.waiting : null;

  return (
    <ConsistencyGate locked={locked}>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{candidate.label}</h1>
          <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
          <p className="max-w-3xl font-mono text-[0.68rem] text-text-muted">{text.privacy}</p>
        </header>

        {note ? <p className="rounded-panel border border-dashed border-border-strong bg-bg-elevated px-5 py-4 text-sm text-text-secondary" aria-live="polite">{note}</p> : null}
        {noBrief ? <p className="text-sm text-text-secondary">{text.noBrief}</p> : null}
        {before.isError && !noBrief ? <p role="alert" className="text-sm text-text-primary">{errorText(before.error, locale)}</p> : null}
        {after.isError ? <p role="alert" className="text-sm text-text-primary">{errorText(after.error, locale)}</p> : null}

        {before.isPending && !noBrief ? (
          <p className="text-sm text-text-muted" aria-live="polite">{text.loading}</p>
        ) : (
          <ConsistencyComparison before={before.data ?? empty(candidateId, 'before')} after={after.data ?? empty(candidateId, 'after')} />
        )}
      </main>
    </ConsistencyGate>
  );
}
