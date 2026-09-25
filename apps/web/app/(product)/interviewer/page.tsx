'use client';

import Link from 'next/link';
import { NextStep } from '../../../components/home/NextStep';
import { SeedPending } from '../../../components/home/SeedPending';
import { StatusPill } from '../../../components/home/StatusPill';
import type { CandidateProgress } from '../../../lib/demo/world';
import { useHomeProgress } from '../../../lib/home/useHomeProgress';
import { ApiUnavailable } from '../../../components/home/ApiUnavailable';
import { useStaffLocale } from '../../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: {
    eyebrow: 'Interviewer',
    title: 'My interviews',
    lede: 'Prepare with the brief, record the interview, score blind. The AI draft opens only after your own scores.',
    next: 'Next step',
    steps: {
      brief: { title: 'Read candidate A’s brief', body: 'Questions for each competency, what to clarify, and the English gap — each with its source.', action: 'Open the brief' },
      briefPending: { title: 'Candidate A’s brief is being prepared', body: 'It is written from the application and the test. The brief page shows it as soon as it is ready.', action: 'Open the brief' },
      record: { title: 'Interview candidate A and record it', body: 'Tick the candidate’s consent and record, or take inVision’s recording. Only the text reaches the model.', action: 'Open the interview' },
      score: { title: 'Score candidate A blind', body: 'Five competencies, 0–4 or “not enough to judge”. No AI opinion is shown until you save.', action: 'Score now' },
      waiting: { title: 'The draft is waiting for the transcript', body: 'Your scores are saved. The draft is written as soon as the transcript is ready.', action: 'Open the interview' },
      compare: { title: 'Compare your scores with the draft', body: 'See where you and the draft differ, and what needs a second look. Nothing is merged.', action: 'Open the comparison' },
    },
    columns: ['Candidate', 'Brief', 'Recording', 'Your scores', 'AI draft', ''],
    brief: { read: 'Read', ready: 'Ready', pending: 'Being prepared', failed: 'Failed', none: 'Not started' },
    recording: { none: 'Not recorded', transcribing: 'Transcribing', ready: 'Transcript ready' },
    scores: { saved: 'Saved', none: 'Not scored' },
    draft: { locked: 'Locked until you score', waiting: 'Waiting for the transcript', ready: 'Open' },
    open: 'Open',
    blind: 'You never see the simulation scores. That is deliberate: you score blind.',
    candidate: 'Candidate',
  },
  ru: {
    eyebrow: 'Интервьюер',
    title: 'Мои интервью',
    lede: 'Подготовьтесь по брифу, запишите интервью, оцените вслепую. Черновик ИИ откроется только после ваших баллов.',
    next: 'Следующий шаг',
    steps: {
      brief: { title: 'Прочитайте бриф кандидата A', body: 'Вопросы по каждой компетенции, что уточнить и разрыв по английскому — у всего есть источник.', action: 'Открыть бриф' },
      briefPending: { title: 'Бриф кандидата A готовится', body: 'Он пишется по анкете и тесту. Страница брифа покажет его, как только он будет готов.', action: 'Открыть бриф' },
      record: { title: 'Проведите и запишите интервью с кандидатом A', body: 'Отметьте согласие кандидата и запишите, или возьмите запись inVision. В модель уходит только текст.', action: 'Открыть интервью' },
      score: { title: 'Оцените кандидата A вслепую', body: 'Пять компетенций, 0–4 или «недостаточно данных». Мнения ИИ не видно, пока вы не сохраните.', action: 'Оценить' },
      waiting: { title: 'Черновик ждёт расшифровку', body: 'Баллы сохранены. Черновик появится, как только будет готова расшифровка.', action: 'Открыть интервью' },
      compare: { title: 'Сравните свои баллы с черновиком', body: 'Где вы с черновиком расходитесь и что стоит перепроверить. Ничего не объединяется.', action: 'Открыть сравнение' },
    },
    columns: ['Кандидат', 'Бриф', 'Запись', 'Ваши баллы', 'Черновик ИИ', ''],
    brief: { read: 'Прочитан', ready: 'Готов', pending: 'Готовится', failed: 'Не удался', none: 'Не начат' },
    recording: { none: 'Не записано', transcribing: 'Расшифровывается', ready: 'Расшифровка готова' },
    scores: { saved: 'Сохранены', none: 'Не выставлены' },
    draft: { locked: 'Закрыт до ваших баллов', waiting: 'Ждёт расшифровку', ready: 'Открыт' },
    open: 'Открыть',
    blind: 'Баллы симуляции вам не видны. Так задумано: вы оцениваете вслепую.',
    candidate: 'Кандидат',
  },
};

function BriefPill({ brief, viewed, text }: { brief: CandidateProgress['brief']; viewed: boolean; text: (typeof copy)['en']['brief'] }) {
  if (brief === 'ready') return <StatusPill tone={viewed ? 'done' : 'waiting'}>{viewed ? text.read : text.ready}</StatusPill>;
  if (brief === 'pending') return <StatusPill tone="active">{text.pending}</StatusPill>;
  if (brief === 'failed') return <StatusPill tone="waiting">{text.failed}</StatusPill>;
  return <StatusPill tone="muted">{text.none}</StatusPill>;
}

/** The interview itself once it exists; before that, the list where it is started. */
function interviewHref(c: CandidateProgress): string {
  return c.interviewId ? `/interviewer/interview/${c.interviewId}` : '/interviewer/interview';
}

function nextFor(a: CandidateProgress) {
  if (!a.briefViewed) return { key: a.brief === 'pending' ? ('briefPending' as const) : ('brief' as const), href: `/interviewer/brief/${a.id}` };
  const open = interviewHref(a);
  if (a.transcript === 'none') return { key: 'record' as const, href: open };
  if (!a.scoresSaved) return { key: 'score' as const, href: open };
  if (!a.draftReady) return { key: 'waiting' as const, href: open };
  return { key: 'compare' as const, href: `${open}#draft-title` };
}

/** The interviewer's home: what to do next, and where each interview stands. */
export default function InterviewerHome() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const { candidates, apiError } = useHomeProgress();
  const a = candidates.A;
  const next = nextFor(a);
  const step = text.steps[next.key];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </header>

      <ApiUnavailable error={apiError} />

      <NextStep label={text.next} title={step.title} body={step.body} href={next.href} action={step.action} />

      <div className="overflow-x-auto rounded-panel border border-border-subtle bg-bg-surface">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {text.columns.map((column, index) => (
                <th key={index} className="px-4 py-2.5 font-mono text-[0.58rem] font-normal tracking-[0.12em] text-text-muted uppercase">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {(['A', 'B', 'C'] as const).map((code) => {
              const c = candidates[code];
              return (
                <tr key={code} className={c.hasData ? '' : 'opacity-60'}>
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    {text.candidate} {code}
                  </td>
                  {c.hasData ? (
                    <>
                      <td className="px-4 py-3">
                        <BriefPill brief={c.brief ?? null} viewed={c.briefViewed} text={text.brief} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={c.transcript === 'ready' ? 'done' : c.transcript === 'transcribing' ? 'active' : 'waiting'}>
                          {text.recording[c.transcript]}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={c.scoresSaved ? 'done' : 'waiting'}>{c.scoresSaved ? text.scores.saved : text.scores.none}</StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={c.draftReady ? 'done' : c.scoresSaved ? 'active' : 'locked'}>
                          {c.draftReady ? text.draft.ready : c.scoresSaved ? text.draft.waiting : text.draft.locked}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={interviewHref(c)} className="text-sm font-semibold text-brand-ink hover:underline">
                          {text.open}
                        </Link>
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="px-4 py-3">
                      <SeedPending />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-l-2 border-border-strong pl-3 text-[0.8rem] text-text-muted">{text.blind}</p>
    </main>
  );
}
