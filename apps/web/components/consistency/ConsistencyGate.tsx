'use client';

import { LockClosedIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCopy } from '../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: {
    title: 'The interviewer has not scored yet',
    body: 'What the interview showed is held back until the interviewer has saved their own scores — the same rule as the AI draft. An interviewer who has already read "the interview confirmed a gap" is no longer scoring blind.',
    action: 'Back to the candidates',
  },
  ru: {
    title: 'Интервьюер ещё не выставил баллы',
    body: 'Итог сверки закрыт, пока интервьюер не сохранил свои баллы, — то же правило, что и у черновика ИИ. Интервьюер, который уже прочитал «интервью подтвердило разрыв», оценивает не вслепую.',
    action: 'К кандидатам',
  },
};

/**
 * The after-interview stage is locked until the interviewer's scores are
 * saved, exactly as the API locks it with `409 DRAFT_LOCKED`. The screen says
 * why, because a lock without a reason reads as a bug.
 */
export function ConsistencyGate({ locked, children }: { locked: boolean; children: ReactNode }) {
  const text = useCopy(copy);

  if (!locked) return <>{children}</>;

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-16 text-center">
      <LockClosedIcon aria-hidden="true" className="h-6 w-6 text-text-muted" />
      <h1 className="text-xl font-bold text-text-primary">{text.title}</h1>
      <p className="max-w-xl text-sm text-text-secondary">{text.body}</p>
      <Link
        href="/commission"
        className="mt-2 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
      >
        {text.action}
      </Link>
    </main>
  );
}
