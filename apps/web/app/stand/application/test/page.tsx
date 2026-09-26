'use client';

import { AppHeader } from '../../../../components/applicant/AppHeader';
import { ForcedChoiceBlock } from '../../../../components/applicant/ForcedChoiceBlock';
import { JourneyRail } from '../../../../components/applicant/JourneyRail';
import { StateCard } from '../../../../components/applicant/StateCard';
import { ProtectedRoute } from '../../../../components/ProtectedRoute';
import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import Link from 'next/link';
import { useTestAttempt } from '../../../../lib/application/useTestAttempt';

function homeLink(label: string) {
  return (
    <Link
      href="/stand"
      className="inline-flex items-center rounded-control bg-brand-green px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
    >
      {label}
    </Link>
  );
}

/**
 * The forced-choice test.
 *
 * Every state the specification separates is separate here too, and the three
 * that are easy to get wrong are the ones that matter: a block that ran out of
 * time is reported as recorded, not as lost; a connection that dropped keeps
 * the block and its deadline on screen instead of resetting them; and an
 * attempt that has moved on elsewhere re-reads the truth from the server rather
 * than retrying a request that cannot succeed.
 *
 * Nothing on this screen shows a score, a competency or whether an answer was
 * "right". There is no such thing here to show.
 */
function TestScreen() {
  const { state, notice, busy, connectionLost, serverOffsetMs, dismissNotice, start, submit, advance, reload } =
    useTestAttempt();

  const progress =
    state.kind === 'block'
      ? {
          started: true,
          done: state.attempt.answeredBlocks + state.attempt.timedOutBlocks,
          total: state.attempt.totalBlocks,
          complete: false,
        }
      : state.kind === 'complete'
        ? {
            started: true,
            done: state.attempt.totalBlocks,
            total: state.attempt.totalBlocks,
            complete: true,
          }
        : { started: false, done: 0, total: 0, complete: false };

  return (
    <>
      <JourneyRail progress={{ test: progress }} />

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-10">
        {connectionLost ? <Alert variant="info">The connection to the server was lost. The block and its deadline are unchanged — wait for the connection, the server keeps the time.</Alert> : null}

        {notice === 'timed-out' ? (
          <Alert variant="info" onDismiss={dismissNotice}>
            The block ran out of time and was recorded without an answer. It does not lower the other blocks — the commission sees it as missing evidence.
          </Alert>
        ) : null}
        {notice === 'conflict' ? (
          <Alert variant="info" onDismiss={dismissNotice}>
            The attempt moved on elsewhere, in another tab perhaps. We re-read it from the server.
          </Alert>
        ) : null}
        {notice === 'locked' ? (
          <Alert variant="info" onDismiss={dismissNotice}>
            This block was already closed with an answer and cannot be changed.
          </Alert>
        ) : null}

        {state.kind === 'loading' ? (
          <div className="rounded-panel border border-border-subtle bg-bg-surface p-6">
            <p className="text-sm text-text-secondary">Loading the state of the test…</p>
          </div>
        ) : null}

        {state.kind === 'no-application' ? (
          <StateCard eyebrow="Forced-choice test" title="The application comes first" action={homeLink('Go to the application')}>
            <p>The test opens once an application exists: it is bound to that application and to its form version.</p>
          </StateCard>
        ) : null}

        {state.kind === 'intro' ? (
          <StateCard
            eyebrow="Forced-choice test"
            title="Forced-choice test"
            action={
              <Button type="button" loading={busy} onClick={() => void start()}>
                Start the test
              </Button>
            }
          >
            <p>Ten blocks of four statements. In each, pick the one most like you and a different one least like you.</p>
            <ul className="mt-4 flex flex-col gap-2 border-l-2 border-border-strong pl-4 text-sm">
              <li>Each block has its own time, counted by the server; reloading the page does not extend it.</li>
              <li>The test is taken once, and a closed block cannot be reopened.</li>
              <li>A block that runs out of time is recorded without an answer and does not lower the rest.</li>
              <li>The statements are in English: that is the language the assessment runs on.</li>
            </ul>
          </StateCard>
        ) : null}

        {state.kind === 'block' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Forced-choice test</p>
                <h1 className="mt-2 text-balance-tight text-2xl font-extrabold sm:text-3xl">
                  {state.attempt.testVersion.title}
                </h1>
              </div>
              <dl className="flex gap-6 text-sm">
                <div>
                  <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
                    Answered
                  </dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-text-primary">
                    {state.attempt.answeredBlocks} / {state.attempt.totalBlocks}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
                    Timed out
                  </dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-text-primary">{state.attempt.timedOutBlocks}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
                    Version
                  </dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-text-primary">
                    {state.attempt.testVersion.version}
                  </dd>
                </div>
              </dl>
            </div>

            <ForcedChoiceBlock
              key={state.block.id}
              attempt={state.attempt}
              block={state.block}
              serverOffsetMs={serverOffsetMs}
              busy={busy}
              onSubmit={(most, least) => void submit(most, least)}
              onExpire={() => void advance()}
            />

            <p className="border-l-2 border-border-strong pl-3 text-xs text-text-muted">No score and no competency appears in the test: the methodology computes them, and the commission decides.</p>
          </>
        ) : null}

        {state.kind === 'complete' ? (
          <StateCard eyebrow="Forced-choice test" title="The test is done" action={homeLink('Back to the dashboard')}>
            <p>Every block is closed. The answers are stored on the server and cannot be changed.</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
                  Answered
                </dt>
                <dd className="mt-0.5 font-mono tabular-nums">
                  {state.attempt.answeredBlocks} / {state.attempt.totalBlocks}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
                  Timed out
                </dt>
                <dd className="mt-0.5 font-mono tabular-nums">{state.attempt.timedOutBlocks}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm">
              <Link href="/stand/application/submit" className="font-semibold text-brand-ink hover:underline">
                Send the application
              </Link>{' '}
              — the last step here.
            </p>
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
            <p>The session expired. Sign in again — the block you started and its deadline are kept on the server.</p>
          </StateCard>
        ) : null}

        {state.kind === 'forbidden' ? (
          <StateCard eyebrow="Access" title="This area is for applicants only">
            <p>Your account does not submit an application. The commission, interviewer and methodology screens arrive in later slices of the product.</p>
          </StateCard>
        ) : null}

        {state.kind === 'failed' ? (
          <StateCard
            eyebrow="Error"
            title="Could not load the data"
            action={
              <Button type="button" loading={busy} onClick={() => void reload()}>
                Try again
              </Button>
            }
          >
            <p>{state.message}</p>
          </StateCard>
        ) : null}
      </main>
    </>
  );
}

export default function TestPage() {
  return (
    <ProtectedRoute>
      <AppHeader />
      <TestScreen />
    </ProtectedRoute>
  );
}
