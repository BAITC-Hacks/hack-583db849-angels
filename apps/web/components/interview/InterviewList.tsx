'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCandidates } from '../../lib/api/candidates';
import type { WireCandidateProgress } from '../../lib/api/contract';
import { errorText } from '../../lib/api/errors';
import { useDemoRole } from '../../lib/DemoRoleProvider';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { useCreateInterview } from '../../lib/interview/queries';
import { StatusPill, type Tone } from '../home/StatusPill';

type Interview = NonNullable<WireCandidateProgress['interview']>;

const copy = {
  en: {
    eyebrow: 'Interviewer',
    title: 'Interviews',
    lede: 'Record the interview with the candidate’s consent, score it blind, then compare with the AI draft.',
    notStarted: 'Not started',
    transcript: { none: 'Not recorded', transcribing: 'Transcribing', ready: 'Transcript ready', failed: 'Transcription failed' },
    scored: 'Scored',
    draft: 'Draft ready',
    start: 'Start the interview',
    open: 'Open',
    loading: 'Loading the candidates…',
  },
  ru: {
    eyebrow: 'Интервьюер',
    title: 'Интервью',
    lede: 'Запишите интервью с согласия кандидата, оцените вслепую, потом сравните с черновиком ИИ.',
    notStarted: 'Не начато',
    transcript: { none: 'Не записано', transcribing: 'Расшифровывается', ready: 'Расшифровка готова', failed: 'Расшифровка не удалась' },
    scored: 'Оценено',
    draft: 'Черновик готов',
    start: 'Начать интервью',
    open: 'Открыть',
    loading: 'Загружаем кандидатов…',
  },
};

const transcriptTone: Record<Interview['transcriptStatus'], Tone> = { none: 'waiting', transcribing: 'active', ready: 'done', failed: 'waiting' };

/** Every candidate's interview and where it is, from `progress.interview`; the interviewer starts one here. */
export function InterviewList() {
  const text = useCopy(copy);
  const { locale } = useStaffLocale();
  const { role } = useDemoRole();
  const router = useRouter();
  const candidates = useCandidates({ poll: 'while-pending' });
  const create = useCreateInterview();
  const canStart = role === 'interviewer' || role === 'admin';

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </header>

      {candidates.isError ? (
        <p role="alert" className="text-sm font-semibold text-text-primary">{errorText(candidates.error, locale)}</p>
      ) : candidates.isPending ? (
        <p className="text-sm text-text-muted" aria-live="polite">{text.loading}</p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-panel border border-border-subtle bg-bg-surface">
          {candidates.data.map((candidate) => {
            const interview = candidate.progress?.interview ?? null;
            return (
              <li key={candidate.candidateId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-semibold text-text-primary">{candidate.label}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {interview ? (
                    <>
                      <StatusPill tone={transcriptTone[interview.transcriptStatus]}>{text.transcript[interview.transcriptStatus]}</StatusPill>
                      {interview.scoresSaved ? <StatusPill tone="done">{text.scored}</StatusPill> : null}
                      {interview.draftReady ? <StatusPill tone="done">{text.draft}</StatusPill> : null}
                      <Link href={`/interviewer/interview/${interview.interviewId}`} className="ml-2 text-sm font-semibold text-brand-ink hover:underline">
                        {text.open}
                      </Link>
                    </>
                  ) : (
                    <>
                      <StatusPill tone="muted">{text.notStarted}</StatusPill>
                      {canStart ? (
                        <button
                          type="button"
                          disabled={create.isPending}
                          onClick={() =>
                            create.mutate(
                              { candidateId: candidate.candidateId },
                              { onSuccess: (record) => router.push(`/interviewer/interview/${record.view.interviewId}`) },
                            )
                          }
                          className="ml-2 text-sm font-semibold text-brand-ink hover:underline disabled:opacity-50"
                        >
                          {text.start}
                        </button>
                      ) : null}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {create.isError ? <p role="alert" className="text-sm text-text-primary">{errorText(create.error, locale)}</p> : null}
    </main>
  );
}
