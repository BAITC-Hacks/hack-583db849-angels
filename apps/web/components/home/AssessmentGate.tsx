'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { candidateByCode, candidatesKey, useCandidates } from '../../lib/api/candidates';
import { api, unwrap } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useDemoRole } from '../../lib/DemoRoleProvider';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';

const staffCopy = {
  en: {
    waiting: 'The report is not ready yet',
    waitingBody: 'It is written when candidate A finishes the simulation.',
    pending: 'The report is being prepared',
    pendingBody: 'The simulation is finished and the assessment is running. This page opens the report as soon as it is ready.',
    failed: 'The assessment could not be made',
    failedBody: 'The simulation is saved. An admin can run the assessment again.',
    rerun: 'Run the assessment again',
    hidden: 'This role does not see the report.',
  },
  ru: {
    waiting: 'Отчёт ещё не готов',
    waitingBody: 'Он появится, когда кандидат A закончит симуляцию.',
    pending: 'Отчёт готовится',
    pendingBody: 'Симуляция закончена, идёт оценка. Страница откроет отчёт, как только он будет готов.',
    failed: 'Оценку сделать не удалось',
    failedBody: 'Симуляция сохранена. Админ может запустить оценку заново.',
    rerun: 'Запустить оценку заново',
    hidden: 'Эта роль не видит отчёт.',
  },
};

function Panel({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-16 text-center">
      <h1 className="text-xl font-bold text-text-primary">{title}</h1>
      {body ? <p className="max-w-lg text-sm text-text-secondary">{body}</p> : null}
      {children}
    </main>
  );
}

/**
 * The way into candidate A's report or feedback, whatever its id: opens it as
 * soon as `progress.assessment` is ready, and until then says where it is —
 * not started, being prepared (polled every 5 seconds), or failed, with a
 * re-run for the admin. A candidate only ever hears "not ready yet".
 */
export function AssessmentGate({ audience }: { audience: 'staff' | 'candidate' }) {
  const router = useRouter();
  const client = useQueryClient();
  const { role } = useDemoRole();
  const { locale } = useStaffLocale();
  const text = useCopy(staffCopy);
  const candidates = useCandidates({ poll: true });
  const progress = candidateByCode(candidates.data, 'A')?.progress;
  const assessment = progress?.assessment ?? null;
  const simulationId = progress?.simulation?.simulationId ?? null;
  const readyId = assessment?.status === 'ready' ? assessment.assessmentId : null;
  const target = audience === 'candidate' ? '/feedback' : '/commission/simulation-report';

  useEffect(() => {
    if (readyId) router.replace(`${target}/${readyId}`);
  }, [readyId, router, target]);

  const rerun = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST('/v1/simulation-assessments', {
          body: { simulationId: id },
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        }),
      ) as unknown as { assessmentId: string },
    onSuccess: ({ assessmentId }) => {
      void client.invalidateQueries({ queryKey: candidatesKey });
      router.replace(`${target}/${assessmentId}`);
    },
  });

  if (audience === 'candidate') {
    return (
      <main lang="en" className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-text-primary">
          {readyId ? 'Opening your feedback…' : 'Your feedback is not ready yet'}
        </h1>
        <p className="text-sm text-text-secondary">It is written after you finish the simulation and it has been reviewed.</p>
        <Link href="/candidate" className="mx-auto mt-2 text-sm font-semibold text-brand-ink hover:underline">
          Back to your home
        </Link>
      </main>
    );
  }

  // An interviewer scores blind: the API sends them no assessment at all.
  if (role === 'interviewer') return <Panel title={text.hidden} />;
  if (candidates.isError) return <Panel title={errorText(candidates.error, locale)} />;
  if (readyId || candidates.isPending) return <Panel title={text.pending} />;
  if (assessment?.status === 'pending') return <Panel title={text.pending} body={text.pendingBody} />;
  if (assessment?.status === 'failed') {
    return (
      <Panel title={text.failed} body={text.failedBody}>
        {role === 'admin' && simulationId ? (
          <button
            type="button"
            disabled={rerun.isPending}
            onClick={() => rerun.mutate(simulationId)}
            className="mt-2 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated disabled:opacity-50"
          >
            {text.rerun}
          </button>
        ) : null}
        {rerun.isError ? (
          <p role="alert" className="text-sm text-text-primary">
            {errorText(rerun.error, locale)}
          </p>
        ) : null}
      </Panel>
    );
  }
  return <Panel title={text.waiting} body={text.waitingBody} />;
}
