import { ArrowRightIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoHeader } from '../../../components/demo/DemoHeader';
import { demoCandidates, demoSteps } from '../../../lib/demo/candidates';

export const metadata: Metadata = { title: 'Choose a candidate — AI Leader ID' };

/**
 * Where the demo starts: pick one of three synthetic candidates and follow them
 * through the brief, the simulation, the report, the interview draft and the
 * quality guard.
 *
 * Steps whose slice has not landed are shown locked rather than hidden, so the
 * whole path is visible from the first screen.
 */
export default function DemoCandidatesPage() {
  const firstStep = demoSteps.find((step) => step.href);

  return (
    <>
      <DemoHeader />

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10">
        <section className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">Demo</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">Choose a candidate</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            Three synthetic candidates, each built to show one thing. None of them is a real person, and nothing on
            these screens accepts or rejects anyone: the decision stays with the interviewer and the commission.
          </p>
        </section>

        <section aria-labelledby="path-title" className="flex flex-col gap-3">
          <h2 id="path-title" className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
            The path
          </h2>
          <ol className="grid gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-5">
            {demoSteps.map((step, index) => (
              <li key={step.module} className="flex flex-col gap-1.5 bg-bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[0.68rem] tracking-[0.12em] text-brand-ink">
                    0{index + 1} · {step.module}
                  </span>
                  {step.href ? null : (
                    <LockClosedIcon aria-label="Not built yet" className="h-3.5 w-3.5 text-text-muted" />
                  )}
                </div>
                <p className="text-sm font-semibold text-text-primary">{step.title}</p>
                <p className="text-[0.8rem] text-text-secondary">{step.note}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="candidates-title" className="flex flex-col gap-3">
          <h2 id="candidates-title" className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
            Candidates
          </h2>
          <ul className="grid gap-4 lg:grid-cols-3">
            {demoCandidates.map((candidate) => (
              <li
                key={candidate.id}
                className="flex flex-col gap-4 rounded-panel border border-border-subtle bg-bg-surface p-5"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft font-mono text-lg font-bold text-brand-ink"
                  >
                    {candidate.code}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">
                      Candidate {candidate.code}
                    </p>
                    <h3 className="text-sm font-semibold text-text-primary">{candidate.headline}</h3>
                  </div>
                </div>

                <p className="text-sm text-text-secondary">{candidate.summary}</p>

                <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
                  <p className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">What to point at</p>
                  <ul className="flex flex-col gap-1">
                    {candidate.watchFor.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[0.8rem] text-text-secondary">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-green" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                  <span className="font-mono text-[0.6rem] text-text-muted">{candidate.id.slice(-12)}</span>
                  {firstStep?.href ? (
                    <Link
                      href={firstStep.href(candidate.id)}
                      className="group inline-flex items-center gap-1.5 rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
                    >
                      Start: {firstStep.title}
                      <ArrowRightIcon
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle px-3 py-2 text-[0.8rem] text-text-muted">
                      <LockClosedIcon aria-hidden="true" className="h-3.5 w-3.5" />
                      Opens when M2 lands
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
