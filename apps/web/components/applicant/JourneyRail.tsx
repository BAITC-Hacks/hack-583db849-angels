'use client';

import { CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type StageId = 'account' | 'application' | 'test' | 'video' | 'submit';

interface Stage {
  id: StageId;
  title: string;
  href?: string;
  /** Stages a later slice still has to build are shown as such, never as dead buttons. */
  locked?: boolean;
}

const stages: Stage[] = [
  { id: 'account', title: 'Account', href: '/stand/profile' },
  { id: 'application', title: 'Application', href: '/stand/application' },
  { id: 'test', title: 'Test', href: '/stand/application/test' },
  { id: 'video', title: 'Video', locked: true },
  { id: 'submit', title: 'Submission', locked: true },
];

export interface JourneyProgress {
  /**
   * Each part is optional, and its absence means "this screen does not know" —
   * not "nothing has happened". The test screen has no business reporting how
   * much of the form is filled in, and saying "0 of 0" there would be a claim
   * it cannot support.
   */
  application?: {
    /** Whether a draft exists at all. */
    started: boolean;
    answered: number;
    total: number;
  };
  test?: {
    started: boolean;
    /** Blocks that are finished, answered or timed out alike. */
    done: number;
    total: number;
    complete: boolean;
  };
}

/**
 * Navigation for the applicant area, and a status line at the same time.
 *
 * A sidebar would list places; this lists the journey, which is what an
 * applicant actually holds in their head — what is done, where they are, what
 * is still closed. The connector between two stages fills with the progress of
 * the stage it leaves, so the rail answers "how much is left" without a
 * separate widget.
 *
 * Stages that later slices will build are locked rather than hidden: an
 * applicant deciding whether to start deserves to see the whole path, and a
 * lock is honest where a dead button is not.
 */
export function JourneyRail({ progress }: { progress?: JourneyProgress }) {
  const pathname = usePathname();

  const application = progress?.application;
  const applicationDone = Boolean(application && application.total > 0 && application.answered === application.total);
  const fill = application && application.total > 0 ? Math.round((application.answered / application.total) * 100) : 0;
  const test = progress?.test;
  const testFill = test && test.total > 0 ? Math.round((test.done / test.total) * 100) : 0;

  function stateOf(stage: Stage): 'done' | 'current' | 'locked' | 'available' {
    if (stage.locked) return 'locked';
    if (stage.id === 'account') return 'done';
    if (stage.id === 'application') {
      if (pathname === '/stand/application') return 'current';
      return applicationDone ? 'done' : 'available';
    }

    if (stage.id === 'test') {
      if (pathname === '/stand/application/test') return 'current';
      return test?.complete ? 'done' : 'available';
    }
    return 'available';
  }

  function captionOf(stage: Stage): string {
    if (stage.id === 'account') return 'Created';
    if (stage.id === 'application') {
      if (!application) return '';
      if (!application.started) return 'Not started';
      if (applicationDone) return 'Filled in';
      return `${application.answered} of ${application.total}`;
    }
    if (stage.id === 'test') {
      if (!test) return '';
      if (!test.started) return 'Not started';
      if (test.complete) return 'Finished';
      return `${test.done} of ${test.total}`;
    }
    return 'Later';
  }

  return (
    <nav aria-label="Application path" className="border-b border-border-subtle bg-bg-base">
      <ol className="mx-auto flex max-w-5xl gap-0 overflow-x-auto px-5 py-3">
        {stages.map((stage, index) => {
          const state = stateOf(stage);
          const isLast = index === stages.length - 1;
          const connectorFill =
            stage.id === 'application' ? fill : stage.id === 'test' ? testFill : state === 'done' ? 100 : 0;

          const node = (
            <span
              className={`journey-node ${
                state === 'done'
                  ? 'bg-brand-green text-on-brand'
                  : state === 'current'
                    ? 'border-brand-ink bg-bg-base text-brand-ink ring-2 ring-brand-ink/25'
                    : state === 'locked'
                      ? 'border-border-strong bg-bg-elevated text-text-muted'
                      : 'border-border-strong bg-bg-elevated text-text-secondary'
              }`}
            >
              {state === 'done' ? (
                <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
              ) : state === 'locked' ? (
                <LockClosedIcon aria-hidden="true" className="h-3 w-3" />
              ) : (
                <span className="font-mono text-[0.62rem]">{index + 1}</span>
              )}
            </span>
          );

          const label = (
            <span className="flex flex-col sm:min-w-0">
              <span
                className={`text-sm font-semibold whitespace-nowrap sm:truncate ${
                  state === 'locked' ? 'text-text-muted' : 'text-text-primary'
                }`}
              >
                {stage.title}
              </span>
              <span className="font-mono text-[0.6rem] tracking-wide whitespace-nowrap text-text-muted sm:truncate">
                {captionOf(stage)}
              </span>
            </span>
          );

          return (
            <li key={stage.id} className="flex flex-none items-center gap-3 sm:min-w-0 sm:flex-1">
              {stage.href && state !== 'locked' ? (
                <Link
                  href={stage.href}
                  aria-current={state === 'current' ? 'step' : undefined}
                  title={state === 'current' ? 'You are here' : undefined}
                  className="journey-step group flex min-w-0 items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink"
                >
                  {node}
                  {label}
                </Link>
              ) : (
                <span className="journey-step flex min-w-0 items-center gap-2.5 px-2 py-1.5">
                  {node}
                  {label}
                </span>
              )}

              {!isLast ? (
                <span aria-hidden="true" className="journey-line">
                  <span className="journey-line-fill" style={{ width: `${connectorFill}%` }} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
