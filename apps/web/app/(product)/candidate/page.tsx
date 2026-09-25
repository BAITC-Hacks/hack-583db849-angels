'use client';

import { ArrowRightIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { candidateByCode, useCandidates } from '../../../lib/api/candidates';
import { api, ApiError, unwrap } from '../../../lib/api/client';
import { errorText } from '../../../lib/api/errors';
import { useCreateSurprise } from '../../../lib/surprise/queries';

const stepAction =
  'mt-auto inline-flex w-fit items-center gap-1.5 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated';

/**
 * The candidate's home: the simulation to play and, afterwards, the feedback.
 * English only, and never a score — not here, not anywhere a candidate can go.
 *
 * Where the candidate is comes from the API (`GET /v1/candidates?include=progress`
 * through inVision's platform key), polled while a step is pending.
 */
export default function CandidateHome() {
  const router = useRouter();
  const candidates = useCandidates({ poll: 'while-pending' });
  const me = candidateByCode(candidates.data, 'A');
  const progress = me?.progress;
  const simulation = progress?.simulation ?? null;
  const assessment = progress?.assessment ?? null;
  const feedbackReady = assessment?.status === 'ready' && Boolean(assessment.assessmentId);

  const start = useMutation({
    mutationFn: async (candidateId: string) =>
      unwrap(
        await api.POST('/v1/simulations', {
          body: { candidateId },
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        }),
      ) as unknown as { simulationId: string },
    onSuccess: ({ simulationId }) => router.push(`/simulation/${simulationId}`),
    onError: (error) => {
      // One simulation per candidate: if it already exists, that is the one to open.
      const existing = error instanceof ApiError && error.code === 'SIMULATION_EXISTS' ? error.details?.simulationId : null;
      if (typeof existing === 'string') router.push(`/simulation/${existing}`);
    },
  });

  // The surprise question is written when the candidate first opens the step, and there is one per candidate.
  const surprise = progress?.surprise ?? null;
  const surpriseDone = surprise?.status === 'transcribing' || surprise?.status === 'answered' || surprise?.status === 'failed';
  const openSurprise = useCreateSurprise();
  const openQuestion = (candidateId: string) =>
    openSurprise.mutate(candidateId, {
      onSuccess: ({ surpriseId }) => router.push(`/candidate/surprise/${surpriseId}`),
      onError: (error) => {
        // One question per candidate: if it already exists, that is the one to open.
        const existing = error instanceof ApiError && error.code === 'SURPRISE_EXISTS' ? error.details?.surpriseId : null;
        if (typeof existing === 'string') router.push(`/candidate/surprise/${existing}`);
      },
    });
  const surpriseError =
    openSurprise.isError && !(openSurprise.error instanceof ApiError && openSurprise.error.code === 'SURPRISE_EXISTS')
      ? errorText(openSurprise.error)
      : null;

  const presentation = progress?.presentation ?? null;

  const status = simulation === null ? 'Not started yet' : simulation.status === 'completed' ? 'Finished — thank you' : 'In progress';
  const startError =
    start.isError && !(start.error instanceof ApiError && start.error.code === 'SIMULATION_EXISTS') ? errorText(start.error) : null;

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

      {candidates.isError ? (
        <p role="alert" className="text-sm text-text-primary">
          {errorText(candidates.error)}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <article className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">Step 1 · the simulation</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {simulation?.status === 'completed' ? (
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-brand-ink" />
            ) : (
              <ClockIcon aria-hidden="true" className="h-4 w-4 text-text-muted" />
            )}
            {candidates.isPending ? 'Loading…' : status}
          </p>
          <p className="text-[0.82rem] text-text-secondary">About 8 minutes, spoken in English. You can stop at any moment.</p>
          {simulation === null && me ? (
            <button
              type="button"
              disabled={start.isPending}
              onClick={() => start.mutate(me.candidateId)}
              className="group mt-auto inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:opacity-50"
            >
              Start the simulation
              <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          ) : null}
          {simulation?.status === 'active' && simulation.simulationId ? (
            <Link
              href={`/simulation/${simulation.simulationId}`}
              className="group mt-auto inline-flex w-fit items-center gap-1.5 rounded-control bg-brand-green px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim"
            >
              Continue
              <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ) : null}
          {startError ? (
            <p role="alert" className="text-[0.8rem] text-text-primary">
              {startError}
            </p>
          ) : null}
        </article>

        <article className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">Step 2 · your feedback</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {feedbackReady ? (
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-brand-ink" />
            ) : (
              <ClockIcon aria-hidden="true" className="h-4 w-4 text-text-muted" />
            )}
            {feedbackReady ? 'Ready to read' : 'Ready after the review'}
          </p>
          <p className="text-[0.82rem] text-text-secondary">Written notes on what went well and what to work on. No scores.</p>
          {feedbackReady ? (
            <Link
              href={`/feedback/${assessment?.assessmentId}`}
              className="group mt-auto inline-flex w-fit items-center gap-1.5 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
            >
              Read your feedback
              <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </article>
        <article className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">Step 3 · a short question</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <ClockIcon aria-hidden="true" className="h-4 w-4 text-text-muted" />
            One attempt, 90 seconds
          </p>
          <p className="text-[0.82rem] text-text-secondary">
            One question about your own application, answered on camera. You have not seen it before — that is the
            point.
          </p>
          {surpriseDone ? (
            <p className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-brand-ink" />
              Your answer is in
            </p>
          ) : surprise?.status === 'expired' ? (
            <p className="mt-auto text-sm text-text-secondary">The time for this question is over.</p>
          ) : surprise ? (
            <Link href={`/candidate/surprise/${surprise.surpriseId}`} className={`group ${stepAction}`}>
              {surprise.status === 'started' ? 'Continue your answer' : 'Open the question'}
              <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <button
              type="button"
              disabled={!me || openSurprise.isPending}
              onClick={() => me && openQuestion(me.candidateId)}
              className={`group ${stepAction} disabled:opacity-50`}
            >
              Open the question
              <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          )}
          {surpriseError ? (
            <p role="alert" className="text-[0.82rem] text-text-primary">
              {surpriseError}
            </p>
          ) : null}
        </article>
        <article className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
          <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">Step 4 · your presentation</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <ClockIcon aria-hidden="true" className="h-4 w-4 text-text-muted" />
            One to three minutes, sent once
          </p>
          <p className="text-[0.82rem] text-text-secondary">
            A short video in English: why inVision U, and one time you led other people. Record it here or upload your
            own.
          </p>
          {presentation ? (
            <p className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-brand-ink" />
              Your presentation is in
            </p>
          ) : (
            <Link href="/candidate/presentation" className={`group ${stepAction}`}>
              Record your presentation
              <ArrowRightIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          )}
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
