'use client';

import { useState } from 'react';
import { ApiError } from '../../lib/api/client';
import { errorText } from '../../lib/api/errors';
import { useCopy, useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import { useCandidates } from '../../lib/api/candidates';
import { latestChecks, useQualityChecks, useRunCalibration, useRunInterviewCheck } from '../../lib/quality/queries';
import type { QualityCheck } from '../../lib/quality/types';
import { QualityCheckPanel } from './QualityPanel';

const copy = {
  en: {
    eyebrow: 'Quality guard',
    title: 'How the interviews are run',
    lede: 'Signals about the process and about an interviewer’s own scale, each with what to do next. Nothing here is about a candidate, and nothing here changes anyone’s score.',
    privacy: 'Built from interview transcripts and from saved scores without candidate data. Quotes are the interviewer’s own questions.',
    interview: 'The latest interview',
    interviewNone: 'No interview has been checked yet. An interview can be checked once its transcript is ready.',
    checkInterview: (label: string) => `Check the interview with ${label}`,
    checking: 'Checking…',
    calibration: 'An interviewer’s scale',
    calibrationNone: 'No scale has been checked yet. Choose an interviewer and a period.',
    ref: 'Interviewer',
    from: 'From',
    to: 'Until (not included)',
    run: 'Check the scale',
    running: 'Checking…',
    loading: 'Loading the checks…',
    forbidden: 'This role does not see the quality checks.',
    interviewNote: (check: QualityCheck) => `${check.interviewerRef ?? 'interviewer not named'} · ${day(check.createdAt)}`,
    calibrationNote: (check: QualityCheck) => `${check.interviewerRef} · ${check.from} – ${check.to} · ${check.interviews ?? '—'} interviews`,
  },
  ru: {
    eyebrow: 'Контроль качества',
    title: 'Как проходят интервью',
    lede: 'Сигналы о процессе и о шкале самого интервьюера, к каждому — что сделать. Здесь нет ничего о кандидате, и ничего здесь не меняет чьи-либо баллы.',
    privacy: 'Собрано из расшифровок интервью и из сохранённых баллов без данных о кандидатах. Цитаты — собственные вопросы интервьюера.',
    interview: 'Последнее интервью',
    interviewNone: 'Ни одно интервью ещё не проверено. Интервью можно проверить, когда готова его расшифровка.',
    checkInterview: (label: string) => `Проверить интервью: ${label}`,
    checking: 'Проверяем…',
    calibration: 'Шкала интервьюера',
    calibrationNone: 'Шкалу ещё не проверяли. Выберите интервьюера и период.',
    ref: 'Интервьюер',
    from: 'С',
    to: 'До (не включая)',
    run: 'Проверить шкалу',
    running: 'Проверяем…',
    loading: 'Загружаем проверки…',
    forbidden: 'Эта роль не видит проверки качества.',
    interviewNote: (check: QualityCheck) => `${check.interviewerRef ?? 'интервьюер не указан'} · ${day(check.createdAt)}`,
    calibrationNote: (check: QualityCheck) => `${check.interviewerRef} · ${check.from} – ${check.to} · интервью: ${check.interviews ?? '—'}`,
  },
};

function day(iso: string): string {
  return iso.slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The last 30 days, `to` being tomorrow so today's interviews count. A
 * rolling window, not the calendar month: on the first of a month a month
 * view would be empty and every scale check would say there is too little
 * history.
 */
function lastThirtyDays(now = new Date()): { from: string; to: string } {
  return { from: day(new Date(now.getTime() - 30 * DAY_MS).toISOString()), to: day(new Date(now.getTime() + DAY_MS).toISOString()) };
}

const field = 'rounded-control border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary';

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-text-primary">{title}</h2>
        {note ? <p className="font-mono text-[0.68rem] text-text-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * M5 on the API: the commission's view of how the interviews themselves are
 * going. Signals and recommendations, never a verdict — and never a word
 * about a candidate. A panel reads this about its own work, which is the only
 * way a check like this is fair to the people being interviewed.
 */
export function QualityGuardScreen() {
  const text = useCopy(copy);
  const { locale } = useStaffLocale();
  const checks = useQualityChecks();
  const run = useRunCalibration();
  const runInterview = useRunInterviewCheck();
  const candidates = useCandidates();
  const transcribed = (candidates.data ?? []).flatMap((candidate) => {
    const interview = candidate.progress?.interview;
    return interview?.transcriptStatus === 'ready' && interview.interviewId ? [{ label: candidate.label, interviewId: interview.interviewId }] : [];
  });
  const latest = latestChecks(checks.data);
  const refs = [...new Set((checks.data ?? []).map((check) => check.interviewerRef).filter((ref): ref is string => Boolean(ref)))];
  const [period, setPeriod] = useState(lastThirtyDays);
  const [interviewerRef, setInterviewerRef] = useState('');
  const ref = interviewerRef || latest.calibration?.interviewerRef || '';

  let body: React.ReactNode;
  if (checks.isPending) {
    body = <p className="text-sm text-text-muted" aria-live="polite">{text.loading}</p>;
  } else if (checks.isError) {
    const forbidden = checks.error instanceof ApiError && checks.error.code === 'FORBIDDEN';
    body = <p role="alert" className="text-sm font-semibold text-text-primary">{forbidden ? text.forbidden : errorText(checks.error, locale)}</p>;
  } else {
    body = (
      <>
        <Section title={text.interview} note={latest.interview ? text.interviewNote(latest.interview) : undefined}>
          {transcribed.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-panel border border-border-subtle bg-bg-surface p-4">
              {transcribed.map((item) => (
                <button
                  key={item.interviewId}
                  type="button"
                  disabled={runInterview.isPending}
                  onClick={() => runInterview.mutate(item.interviewId)}
                  className="rounded-control border border-border-strong px-3 py-2 text-sm font-semibold text-text-primary hover:bg-bg-elevated disabled:opacity-50"
                >
                  {runInterview.isPending && runInterview.variables === item.interviewId ? text.checking : text.checkInterview(item.label)}
                </button>
              ))}
              {runInterview.isError ? (
                <p role="alert" className="basis-full text-sm text-text-primary">
                  {errorText(runInterview.error, locale)}
                </p>
              ) : null}
            </div>
          ) : null}
          {latest.interview ? (
            <QualityCheckPanel check={latest.interview} />
          ) : (
            <p className="rounded-panel border border-border-subtle bg-bg-surface p-5 text-sm text-text-secondary">{text.interviewNone}</p>
          )}
        </Section>

        <Section title={text.calibration} note={latest.calibration ? text.calibrationNote(latest.calibration) : undefined}>
          <form
            className="flex flex-wrap items-end gap-3 rounded-panel border border-border-subtle bg-bg-surface p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (ref) run.mutate({ interviewerRef: ref, ...period });
            }}
          >
            <label className="flex flex-col gap-1 text-[0.75rem] text-text-secondary">
              {text.ref}
              <input
                list="interviewer-refs"
                value={ref}
                onChange={(event) => setInterviewerRef(event.target.value)}
                required
                maxLength={64}
                className={`${field} w-56 font-mono`}
              />
              <datalist id="interviewer-refs">
                {refs.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-[0.75rem] text-text-secondary">
              {text.from}
              <input type="date" value={period.from} required onChange={(event) => setPeriod({ ...period, from: event.target.value })} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[0.75rem] text-text-secondary">
              {text.to}
              <input type="date" value={period.to} required onChange={(event) => setPeriod({ ...period, to: event.target.value })} className={field} />
            </label>
            <button
              type="submit"
              disabled={!ref || run.isPending}
              className="rounded-control bg-brand-green px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:opacity-50"
            >
              {run.isPending ? text.running : text.run}
            </button>
            {run.isError ? (
              <p role="alert" className="basis-full text-sm text-text-primary">
                {errorText(run.error, locale)}
              </p>
            ) : null}
          </form>
          {latest.calibration ? (
            <QualityCheckPanel check={latest.calibration} />
          ) : (
            <p className="rounded-panel border border-border-subtle bg-bg-surface p-5 text-sm text-text-secondary">{text.calibrationNone}</p>
          )}
        </Section>
      </>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
        <p className="max-w-3xl font-mono text-[0.68rem] text-text-muted">{text.privacy}</p>
      </header>
      {body}
    </main>
  );
}
