'use client';

import type { ActiveCycle, ApplicationDraft, TestAttemptSummary } from '@invision/stand-client';
import { formatDateTime } from '../../lib/format';

/**
 * The whole application in one table: every step, its state, and the facts
 * behind that state.
 *
 * It is deliberately a ledger rather than a set of cards. An applicant checking
 * in wants to know where they stand, and a row of numbers — answered, version,
 * saves, blocks left — answers that faster than prose does. The tone is the
 * product's: plain statements, no encouragement, nothing softened.
 *
 * A step later slices will build is listed as such. Hiding it would be kinder
 * and less honest: the path has five steps whether or not three of them exist
 * yet.
 */
type StepState = 'done' | 'current' | 'waiting' | 'later' | 'unknown';

function Mark({ state }: { state: StepState }) {
  const styles: Record<StepState, string> = {
    done: 'bg-brand-green',
    current: 'bg-brand-ink',
    waiting: 'bg-border-strong',
    later: 'bg-border-subtle',
    unknown: 'bg-st-mid',
  };

  return <span aria-hidden="true" className={`mt-1.5 block h-1.5 w-1.5 rounded-full ${styles[state]}`} />;
}

export function StatusLedger({
  cycle,
  draft,
  test,
  email,
}: {
  cycle: ActiveCycle;
  draft: ApplicationDraft | null;
  test: TestAttemptSummary | null | undefined;
  email?: string;
}) {
  const answered = draft ? Object.keys(draft.answers).length : 0;
  const total = cycle.formVersion.questions.length;
  const applicationDone = Boolean(draft) && answered === total;
  const testDone = test?.status === 'COMPLETED';
  const testStarted = Boolean(test);

  const rows: { id: string; title: string; state: StepState; status: string; facts: string[] }[] = [
    {
      id: 'account',
      title: 'Account',
      state: 'done',
      status: 'Created',
      facts: email ? [email] : [],
    },
    {
      id: 'application',
      title: 'Application',
      state: draft ? (applicationDone ? 'done' : 'current') : 'waiting',
      status: draft ? (applicationDone ? 'Complete' : 'Draft') : 'Not started',
      facts: draft
        ? [
            `answered ${answered}/${total}`,
            `form v${draft.formVersion.version}`,
            `saves ${draft.revision}`,
            `updated ${formatDateTime(draft.updatedAt)}`,
          ]
        : [`cycle: ${cycle.name}`],
    },
    {
      id: 'test',
      title: 'Test',
      state: test === undefined ? 'unknown' : testDone ? 'done' : testStarted ? 'current' : draft ? 'waiting' : 'later',
      status:
        test === undefined
          ? 'Unknown'
          : testDone
            ? 'Finished'
            : test
              ? 'In progress'
              : 'Not started',
      facts: test
        ? [
            `blocks ${test.answeredBlocks + test.timedOutBlocks}/${test.totalBlocks}`,
            `timed out ${test.timedOutBlocks}`,
            `test v${test.testVersion.version}`,
          ]
        : ['one attempt, the server counts each block'],
    },
    { id: 'video', title: 'Video', state: 'later', status: 'Later', facts: ['opens after the test'] },
    { id: 'submit', title: 'Submission', state: 'later', status: 'Later', facts: ['submitted once, after the video'] },
  ];

  return (
    <section className="overflow-hidden rounded-panel border border-border-subtle bg-bg-surface">
      <header className="flex items-baseline justify-between border-b border-border-subtle px-5 py-3">
        <h2 className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">State of the application</h2>
        <p className="font-mono text-[0.58rem] tracking-wide text-text-muted">{cycle.name}</p>
      </header>

      <dl className="divide-y divide-border-subtle">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[10rem_9rem_1fr]">
            <dt className="flex items-start gap-2">
              <Mark state={row.state} />
              <span
                className={`text-sm font-semibold ${row.state === 'later' ? 'text-text-muted' : 'text-text-primary'}`}
              >
                {row.title}
              </span>
            </dt>
            <dd className="font-mono text-[0.68rem] tracking-wide text-text-secondary uppercase">{row.status}</dd>
            <dd className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-text-muted">
              {row.facts.map((fact) => (
                <span key={fact} className="font-mono tabular-nums">
                  {fact}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
