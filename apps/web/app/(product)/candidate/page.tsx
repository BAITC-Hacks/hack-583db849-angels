'use client';

import { ArrowRightIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useWorld } from '../../../lib/demo/world';

/**
 * The candidate's home: the simulation to play and, afterwards, the feedback.
 * English only, and never a score — not here, not anywhere a candidate can go.
 */
export default function CandidateHome() {
  const { candidates } = useWorld();
  const me = candidates.A;

  const simulation = {
    'not-started': { status: 'Not started yet', action: 'Start the simulation' },
    'in-progress': { status: 'In progress', action: 'Continue' },
    completed: { status: 'Finished — thank you', action: null },
  }[me.simulation];

  return (
    <main lang="en" className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">inVision U · leadership simulation</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">Show how you lead</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          A short work situation in English. You talk with one person on a team that is about to fall apart. There are
          no right answers — what matters is how you act.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">Step 1 · the simulation</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {me.simulation === 'completed' ? (
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-brand-ink" />
            ) : (
              <ClockIcon aria-hidden="true" className="h-4 w-4 text-text-muted" />
            )}
            {simulation.status}
          </p>
          <p className="text-[0.82rem] text-text-secondary">About 8 minutes, five of your turns, typed in English.</p>
          {simulation.action ? (
            <Link
              href="/simulation/preview"
              className="group mt-auto inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
            >
              {simulation.action}
              <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </article>

        <article className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">Step 2 · your feedback</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {me.assessmentReady ? (
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-brand-ink" />
            ) : (
              <ClockIcon aria-hidden="true" className="h-4 w-4 text-text-muted" />
            )}
            {me.assessmentReady ? 'Ready to read' : 'Ready after the review'}
          </p>
          <p className="text-[0.82rem] text-text-secondary">Written notes on what went well and what to work on. No scores.</p>
          {me.assessmentReady ? (
            <Link
              href="/feedback/preview"
              className="group mt-auto inline-flex w-fit items-center gap-1.5 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
            >
              Read your feedback
              <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </article>
      </section>

      <section className="rounded-panel border border-border-subtle bg-bg-elevated p-5">
        <h2 className="text-sm font-semibold text-text-primary">Before you start</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[0.85rem] text-text-secondary">
          <li>Answer as you would at work. There are no right answers.</li>
          <li>Grammar mistakes do not count against you: English is looked at separately from leadership.</li>
          <li>You can stop at any moment.</li>
          <li>People make every decision about your application. This simulation does not accept or reject anyone.</li>
        </ul>
      </section>
    </main>
  );
}
