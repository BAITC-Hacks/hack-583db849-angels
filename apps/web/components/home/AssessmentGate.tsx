'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { completeWithRecordedSession, useWorld } from '../../lib/demo/world';
import { useCopy } from '../../lib/i18n/StaffLocaleProvider';

const staffCopy = {
  en: {
    title: 'The report is not ready yet',
    body: 'It is written when candidate A finishes the simulation. For the demo you can use the recorded session.',
    action: 'Use the recorded session',
  },
  ru: {
    title: 'Отчёт ещё не готов',
    body: 'Он появится, когда кандидат A закончит симуляцию. Для демо можно взять записанную сессию.',
    action: 'Взять записанную сессию',
  },
};

/**
 * Shows the report or the feedback only once the simulation behind it is
 * finished, as the API will. A candidate is pointed back to the simulation;
 * staff can use the recorded session to move the demo on.
 */
export function AssessmentGate({ audience, children }: { audience: 'staff' | 'candidate'; children: ReactNode }) {
  const { candidates } = useWorld();
  const text = useCopy(staffCopy);

  if (candidates.A.assessmentReady) return <>{children}</>;

  if (audience === 'candidate') {
    return (
      <main lang="en" className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-text-primary">Your feedback is not ready yet</h1>
        <p className="text-sm text-text-secondary">It is written after you finish the simulation and it has been reviewed.</p>
        <Link href="/candidate" className="mx-auto mt-2 text-sm font-semibold text-brand-ink hover:underline">
          Back to your home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-16 text-center">
      <h1 className="text-xl font-bold text-text-primary">{text.title}</h1>
      <p className="max-w-lg text-sm text-text-secondary">{text.body}</p>
      <button
        type="button"
        onClick={() => completeWithRecordedSession('A')}
        className="mt-2 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
      >
        {text.action}
      </button>
    </main>
  );
}
