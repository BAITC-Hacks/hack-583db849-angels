'use client';

import Link from 'next/link';
import { candidateById, useCandidates } from '../../lib/api/candidates';
import { ApiError } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useBrief, useRerunBrief } from '../../lib/brief/queries';
import type { InterviewerBrief } from '../../lib/brief/types';
import { useDemoRole } from '../../lib/DemoRoleProvider';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { homeFor } from '../../lib/roles';
import { MarkBriefViewed } from '../home/MarkBriefViewed';
import { CandidateSurprise } from '../surprise/CandidateSurprise';
import { BriefClarify, BriefConsistency, BriefEnglish, BriefQuestions } from './BriefSections';
import { SourcesPanel } from './SourcesPanel';

const copy = {
  en: {
    eyebrow: 'Interviewer brief',
    lede: 'Read it before the interview: what to ask, and what the candidate said about themselves against what was measured. Every item shows where it comes from, and nothing here is a score.',
    privacy: 'The model saw the answers, not the person: no name, IIN, contacts, school, region or photo.',
    summary: 'In short',
    newer: 'A newer brief is being prepared. It replaces this one as soon as it is ready.',
    loading: 'Opening the brief…',
    pending: 'The brief is being prepared',
    pendingBody: 'It is written from the application and the test. This page opens it as soon as it is ready.',
    failed: 'The brief could not be made',
    failedBody: 'The application is saved. An admin can make the brief again.',
    none: 'There is no brief for this candidate yet',
    noneBody: 'It is made by itself when the candidate arrives from the platform.',
    rerun: 'Make the brief again',
    rerunning: 'Making the brief…',
    retry: 'Try again',
    forbidden: 'This role does not see the brief.',
    unknown: 'Candidate not found.',
    back: 'Back to the home',
  },
  ru: {
    eyebrow: 'Бриф для интервьюера',
    lede: 'Прочитайте перед интервью: что спросить и что заявил кандидат против того, что измерено. У каждого пункта виден источник, и оценок здесь нет.',
    privacy: 'Модель видела ответы, а не человека: без имени, ИИН, контактов, школы, региона и фото.',
    summary: 'Коротко',
    newer: 'Готовится более новый бриф. Он заменит этот, как только будет готов.',
    loading: 'Открываем бриф…',
    pending: 'Бриф готовится',
    pendingBody: 'Он пишется по анкете и тесту. Страница откроет его, как только он будет готов.',
    failed: 'Бриф сделать не удалось',
    failedBody: 'Анкета сохранена. Админ может сделать бриф заново.',
    none: 'Брифа для этого кандидата пока нет',
    noneBody: 'Он появляется сам, когда кандидат приходит с платформы.',
    rerun: 'Сделать бриф заново',
    rerunning: 'Делаем бриф…',
    retry: 'Повторить',
    forbidden: 'Эта роль не видит бриф.',
    unknown: 'Кандидат не найден.',
    back: 'На главную',
  },
};

const button =
  'rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated disabled:opacity-50';

function Notice({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-16 text-center">
      <h1 className="text-xl font-bold text-text-primary">{title}</h1>
      {body ? <p className="max-w-lg text-sm text-text-secondary">{body}</p> : null}
      {children}
    </main>
  );
}

/**
 * M1 for one candidate, from the API: everything the interviewer needs in one
 * screen before the meeting — questions for each D.R.I.V.E. letter and for the
 * three things no rubric covers, what they claimed against what was measured,
 * topics to clarify and the English gap. Every item is traceable to the answer
 * it came from. Until the brief is ready the screen says where it is, from
 * `progress.brief`, and opens it by itself once it is.
 */
export function BriefScreen({ candidateId }: { candidateId: string }) {
  const text = useCopy(copy);
  const { locale } = useStaffLocale();
  const { role } = useDemoRole();
  const candidates = useCandidates({ poll: 'while-pending' });
  const candidate = candidateById(candidates.data, candidateId);
  const progress = candidate?.progress?.brief;
  const brief = useBrief(candidateId, progress);
  const rerun = useRerunBrief(candidateId);
  const back = (
    <Link href={homeFor[role]} className="text-sm font-semibold text-brand-ink hover:underline">
      {text.back}
    </Link>
  );

  if (brief.data) {
    return <BriefView brief={brief.data} label={candidate?.label ?? ''} newer={progress?.status === 'pending'} />;
  }
  if (brief.isPending || candidates.isPending) {
    return <Notice title={text.loading} />;
  }

  const code = brief.error instanceof ApiError ? brief.error.code : null;
  if (code === 'FORBIDDEN') return <Notice title={text.forbidden}>{back}</Notice>;
  if (code !== 'BRIEF_NOT_FOUND') {
    return (
      <Notice title={errorText(brief.error, locale)}>
        <button type="button" disabled={brief.isFetching} onClick={() => void brief.refetch()} className={button}>
          {text.retry}
        </button>
      </Notice>
    );
  }
  if (candidates.isSuccess && !candidate) return <Notice title={text.unknown}>{back}</Notice>;
  if (progress?.status === 'pending' || rerun.isPending) {
    return <Notice title={rerun.isPending ? text.rerunning : text.pending} body={text.pendingBody} />;
  }

  const failed = progress?.status === 'failed';
  return (
    <Notice title={failed ? text.failed : text.none} body={failed ? text.failedBody : text.noneBody}>
      {role === 'admin' ? (
        <button type="button" onClick={() => rerun.mutate()} className={`mt-2 ${button}`}>
          {rerun.isError ? text.retry : text.rerun}
        </button>
      ) : null}
      {rerun.isError ? (
        <p role="alert" className="text-sm text-text-primary">
          {errorText(rerun.error, locale)}
        </p>
      ) : null}
      {back}
    </Notice>
  );
}

function BriefView({ brief, label, newer }: { brief: InterviewerBrief; label: string; newer: boolean }) {
  const text = useCopy(copy);

  return (
    <>
      <MarkBriefViewed candidateId={brief.candidateId} />
      {newer ? (
        <p
          aria-live="polite"
          className="border-b border-border-subtle bg-bg-elevated px-5 py-1.5 text-center font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase"
        >
          {text.newer}
        </p>
      ) : null}

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
          <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{label}</h1>
          <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
          <p className="max-w-3xl font-mono text-[0.68rem] text-text-muted">{text.privacy}</p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="flex flex-col gap-6">
            <section className="rounded-panel border-l-2 border-brand-green bg-bg-surface px-5 py-4">
              <h2 className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">{text.summary}</h2>
              <p className="mt-1 text-sm text-text-primary">{brief.summary}</p>
            </section>
            <BriefQuestions questions={brief.questions} />
            <BriefConsistency items={brief.consistency} />
            <CandidateSurprise candidateId={brief.candidateId} />
            <div className="grid items-start gap-4 md:grid-cols-2">
              <BriefClarify items={brief.clarify} />
              <BriefEnglish english={brief.english} />
            </div>
          </div>

          <div className="lg:sticky lg:top-6">
            <SourcesPanel application={brief.application} test={brief.test} />
          </div>
        </div>
      </main>
    </>
  );
}
