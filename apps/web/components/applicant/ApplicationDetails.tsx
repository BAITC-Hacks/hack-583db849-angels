'use client';

import type { ActiveCycle, ApplicationDraft, TestAttemptSummary } from '@invision/stand-client';
import { formatDateTime } from '../../lib/format';

/**
 * Everything behind the ledger: which questions are answered, what the
 * application is bound to, and the rules that will not bend later.
 *
 * The ledger says where the applicant stands; this says what that is made of.
 * Both exist because the alternative — a reassuring sentence and a button — is
 * how people arrive at a deadline believing they had already finished.
 *
 * Only the applicant's own data appears, and only as much as they gave: an
 * answered question is marked answered, never quoted back. Nothing here is a
 * score, and nothing here is evidence.
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2 last:border-b-0">
      <dt className="font-mono text-[0.62rem] tracking-[0.1em] text-text-muted uppercase">{label}</dt>
      <dd className="font-mono text-[0.78rem] tabular-nums text-text-secondary">{value}</dd>
    </div>
  );
}

export function ApplicationDetails({
  cycle,
  draft,
  test,
}: {
  cycle: ActiveCycle;
  draft: ApplicationDraft;
  test: TestAttemptSummary | null | undefined;
}) {

  const answers = draft.answers as Record<string, unknown>;
  const shortId = (id: string) => id.slice(0, 8);
  const when = (value: string) => formatDateTime(value);

  // items-start: each column ends where its own content ends, instead of the
  // shorter one being stretched to match its neighbour.
  return (
    <section className="grid items-start gap-4 lg:grid-cols-2">
      <div className="rounded-panel border border-border-subtle bg-bg-surface p-5">
        <h2 className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Application questions</h2>

        <ul className="mt-3">
          {cycle.formVersion.questions.map((question) => {
            const answered = answers[question.id] !== undefined && answers[question.id] !== null;

            return (
              <li
                key={question.id}
                className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-b-0"
              >
                <span className="text-[0.9rem] text-text-primary">{question.label}</span>
                <span
                  className={`shrink-0 font-mono text-[0.68rem] tracking-wide uppercase ${
                    answered ? 'text-brand-ink' : 'text-text-muted'
                  }`}
                >
                  {answered ? 'answered' : 'empty'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-panel border border-border-subtle bg-bg-surface p-5">
          <h2 className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Technical details</h2>

          <dl className="mt-3">
            <Row label="cycle" value={cycle.name} />
            <Row label="Application · created" value={when(draft.createdAt)} />
            <Row label="Application · updated" value={when(draft.updatedAt)} />
            <Row label="form version" value={`v${draft.formVersion.version} · ${shortId(draft.formVersion.id)}`} />
            <Row
              label="Test attempt · started"
              value={test ? when(test.startedAt) : 'none'}
            />
            <Row
              label="test version"
              value={test ? `v${test.testVersion.version} · ${shortId(test.testVersion.id)}` : 'none'}
            />
          </dl>
        </div>

        <div className="rounded-panel border border-border-subtle bg-bg-elevated p-5">
          <h2 className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Rules</h2>

          <ul className="mt-3 flex flex-col gap-2 text-[0.85rem] text-text-secondary">
            <li className="border-l-2 border-border-strong pl-3">Application answers stay editable until the final submission.</li>
            <li className="border-l-2 border-border-strong pl-3">The test is taken once, and a closed block does not reopen.</li>
            <li className="border-l-2 border-border-strong pl-3">The server counts the time for each block; reloading the page does not extend it.</li>
            <li className="border-l-2 border-border-strong pl-3">There is one submission, and it comes after the video.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
