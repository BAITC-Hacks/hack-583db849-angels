'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { AppHeader } from './AppHeader';
import { JourneyRail } from './JourneyRail';
import { ApplicationDetails } from './ApplicationDetails';
import { StateCard } from './StateCard';
import { StatusLedger } from './StatusLedger';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import Link from 'next/link';
import { useApiErrorText } from '../../lib/stand/errorPresentation';
import { useApplicantHome } from '../../lib/application/useApplicantHome';
import { useAuth } from '../../lib/auth/AuthContext';
import { formatDate } from '../../lib/format';
import { findSubmission } from '../../mocks/platformExport';

/**
 * What to do next, said plainly, by looking at what has actually happened.
 *
 * The card used to say "continue the application" whatever the state was, so an
 * applicant who had answered everything and finished the test was still being
 * told to go back and fill in a form. Each stage now has its own words and its
 * own action, and a stage nobody has built yet says so instead of offering a
 * button that leads nowhere.
 */
function NextStep({ state }: { state: Extract<ReturnType<typeof useApplicantHome>['state'], { kind: 'continue' }> & { submitted: boolean } }) {
  const { cycle, draft, test } = state;

  const total = cycle.formVersion.questions.length;
  const answered = Object.keys(draft.answers).length;
  const formDone = total > 0 && answered === total;
  const testDone = test?.status === 'COMPLETED';

  const open = (href: '/stand/application' | '/stand/application/test' | '/stand/application/submit', label: string, primary: boolean) => (
    <Link
      key={href + label}
      href={href}
      className={
        primary
          ? 'group inline-flex items-center gap-2 rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim'
          : 'inline-flex items-center rounded-control border border-border-strong px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated'
      }
    >
      {label}
      {primary ? (
        <ArrowRightIcon
          aria-hidden="true"
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      ) : null}
    </Link>
  );

  if (state.submitted) {
    return (
      <StateCard
        eyebrow="Next step"
        title="Your application is sent"
        action={open('/stand/application/submit', 'Continue to your inVision U steps', true)}
      >
        <p>inVision U has your answers. The simulation, a short question, your video and the interview are next.</p>
      </StateCard>
    );
  }

  if (testDone && test) {
    return (
      <StateCard
        eyebrow="Next step"
        title="The test is done"
        action={
          <>
            {open('/stand/application/submit', 'Send the application', true)}
            {open('/stand/application', 'Open the application', false)}
          </>
        }
      >
        <p>
          {`Every block is closed: ${test.answeredBlocks} answered, ${test.timedOutBlocks} timed out. Sending the application is the last step here.`}
        </p>
      </StateCard>
    );
  }

  if (test) {
    return (
      <StateCard
        eyebrow="Next step"
        title="The test is under way"
        action={
          <>
            {open('/stand/application/test', 'Resume the test', true)}
            {open('/stand/application', 'Open the application', false)}
          </>
        }
      >
        <p>
          {`${test.answeredBlocks + test.timedOutBlocks} of ${test.totalBlocks} blocks are behind you. A closed block does not reopen, and the one you started is waiting with the same deadline.`}
        </p>
      </StateCard>
    );
  }

  if (formDone) {
    return (
      <StateCard
        eyebrow="Next step"
        title="The application is complete"
        action={
          <>
            {open('/stand/application/test', 'Start the test', true)}
            {open('/stand/application', 'Open the application', false)}
          </>
        }
      >
        <p>{`All ${total} questions are answered. The test comes next: ten blocks, each timed by the server.`}</p>
      </StateCard>
    );
  }

  return (
    <StateCard
      eyebrow="Next step"
      title="Continue the application"
      action={
        <>
          {open('/stand/application', 'Continue', true)}
          {open('/stand/application/test', 'Go to the test', false)}
        </>
      }
    >
      <p>{`${answered} of ${total} questions answered. Answers save as you go; nothing has to be sent.`}</p>
    </StateCard>
  );
}

/**
 * The applicant's home screen: one place that says what state the application
 * is in and what to do next.
 *
 * Dense and plain by intention — this is the working half of the product, not
 * the showcase. Only the application draft exists so far; the test and the
 * video are shown as what they are, steps that later slices will build, rather
 * than as buttons that do nothing.
 */
export function ApplicantHome() {
  const { user } = useAuth();
  const { state, creating, reload, apply } = useApplicantHome();
  const describeApiError = useApiErrorText();
  const [error, setError] = useState<string | null>(null);

  async function handleApply(cycleId: string) {
    setError(null);
    try {
      await apply(cycleId);
    } catch (caught) {
      setError(describeApiError(caught).message);
    }
  }

  const progress =
    state.kind === 'continue'
      ? {
          application: {
            started: true,
            answered: Object.keys(state.draft.answers).length,
            total: state.cycle.formVersion.questions.length,
          },
          test: state.test
            ? {
                started: true,
                done: state.test.answeredBlocks + state.test.timedOutBlocks,
                total: state.test.totalBlocks,
                complete: state.test.status === 'COMPLETED',
              }
            : { started: false, done: 0, total: 0, complete: false },
        }
      : {
          application: {
            started: false,
            answered: 0,
            total: state.kind === 'apply' ? state.cycle.formVersion.questions.length : 0,
          },
        };

  return (
    <>
      <AppHeader />
      <JourneyRail progress={progress} />

      <main className="mx-auto max-w-5xl px-5 py-10">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Applicant area</p>
        <h1 className="mt-2 text-balance-tight text-2xl font-extrabold sm:text-3xl">
          {user ? `Hello, ${user.fullName}` : 'Your account'}
        </h1>

        <div className="mt-8 flex flex-col gap-4">
          {error ? <Alert>{error}</Alert> : null}

          {state.kind === 'loading' ? (
            <div className="rounded-panel border border-border-subtle bg-bg-surface p-6">
              <p className="text-sm text-text-secondary">Loading the state of your application…</p>
            </div>
          ) : null}

          {state.kind === 'no-cycle' ? (
            <StateCard eyebrow="Admissions" title="Admissions are closed at the moment">
              <p>There is no open intake. This is an ordinary state, not a failure: when admissions open, the application can be started right here. The admissions office announces the terms.</p>
            </StateCard>
          ) : null}

          {state.kind === 'forbidden' ? (
            <StateCard eyebrow="Access" title="This area is for applicants only">
              <p>Your account does not submit an application. Staff work in the AI layer: briefs, interviews and the commission’s review are there.</p>
            </StateCard>
          ) : null}

          {state.kind === 'session-expired' ? (
            <StateCard
              eyebrow="Session"
              title="Your session has expired"
              action={
                <Link
                  href="/stand/login"
                  className="inline-flex items-center rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
                >
                  Sign in again
                </Link>
              }
            >
              <p>We do not keep the session in the browser, so after a long break you need to sign in again.</p>
            </StateCard>
          ) : null}

          {state.kind === 'failed' ? (
            <StateCard
              eyebrow="Error"
              title="Could not load the data"
              action={
                <Button type="button" onClick={() => void reload()}>
                  Try again
                </Button>
              }
            >
              <p>{state.message}</p>
            </StateCard>
          ) : null}

          {state.kind === 'apply' ? (
            <StatusLedger cycle={state.cycle} draft={null} test={null} email={user?.email} />
          ) : null}

          {state.kind === 'continue' ? (
            <StatusLedger
              cycle={state.cycle}
              draft={state.draft}
              test={state.test}
              email={user?.email}
              submitted={Boolean(user && findSubmission(user.id))}
            />
          ) : null}

          {state.kind === 'apply' ? (
            <StateCard
              eyebrow="Admissions are open"
              title={state.cycle.name}
              action={
                <Button type="button" loading={creating} onClick={() => void handleApply(state.cycle.id)}>
                  Start the application
                </Button>
              }
            >
              <p>
                {`The form is assembled from version “${state.cycle.formVersion.title}”, published on ${formatDate(state.cycle.formVersion.publishedAt)}. Answers are saved as you go; nothing has to be sent right away.`}
              </p>
            </StateCard>
          ) : null}

          {state.kind === 'continue' ? <NextStep state={{ ...state, submitted: Boolean(user && findSubmission(user.id)) }} /> : null}

          {state.kind === 'continue' ? (
            <ApplicationDetails cycle={state.cycle} draft={state.draft} test={state.test} />
          ) : null}

        </div>
      </main>
    </>
  );
}
