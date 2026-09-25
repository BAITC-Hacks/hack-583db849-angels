'use client';

import Link from 'next/link';
import { AccommodationControl } from '../../../components/home/AccommodationControl';
import { NextStep } from '../../../components/home/NextStep';
import { SeedPending } from '../../../components/home/SeedPending';
import { StatusPill } from '../../../components/home/StatusPill';
import { useWorld } from '../../../lib/demo/world';
import { previewCalibrationCheck, previewInterviewCheck } from '../../../lib/quality/preview';
import { useStaffLocale } from '../../../lib/i18n/StaffLocaleProvider';

const copy = {
  en: {
    eyebrow: 'Commission',
    title: 'Candidates in review',
    lede: 'The evidence behind each candidate, in one place. Decisions are recorded in inVision’s system — nothing here accepts or rejects anyone.',
    tiles: { simulations: 'Simulations finished', reports: 'Reports ready', interviews: 'Interviews scored', quality: 'Quality signals' },
    qualityNote: 'about the interviews, not the candidates',
    next: 'Next step',
    wait: { title: 'Candidate A has not finished the simulation', body: 'The report appears as soon as the candidate finishes.' },
    read: { title: 'Candidate A’s report is ready', body: 'D.R.I.V.E. scores with verbatim quotes, questions for the interview, English measured apart.', action: 'Open the report' },
    columns: ['Candidate', 'Simulation', 'Report', 'Interview', 'Consistency', 'Candidate feedback'],
    simulation: { 'not-started': 'Not started', 'in-progress': 'In progress', completed: 'Finished' },
    report: { open: 'Open report', waiting: 'After the simulation' },
    interview: { none: 'Not scored yet', scored: 'Scored blind', draft: 'Scored · draft ready' },
    consistency: { open: 'Open comparison', waiting: 'After the interviewer scores' },
    feedback: { open: 'Preview', waiting: 'After the report' },
    candidate: 'Candidate',
  },
  ru: {
    eyebrow: 'Комиссия',
    title: 'Кандидаты на рассмотрении',
    lede: 'Доказательства по каждому кандидату в одном месте. Решения фиксируются в системе inVision — здесь никого не принимают и не отклоняют.',
    tiles: { simulations: 'Симуляций пройдено', reports: 'Отчётов готово', interviews: 'Интервью оценено', quality: 'Сигналов качества' },
    qualityNote: 'о самих интервью, не о кандидатах',
    next: 'Следующий шаг',
    wait: { title: 'Кандидат A ещё не прошёл симуляцию', body: 'Отчёт появится, как только кандидат закончит.' },
    read: { title: 'Отчёт по кандидату A готов', body: 'Баллы D.R.I.V.E. с дословными цитатами, вопросы для интервью, английский отдельно.', action: 'Открыть отчёт' },
    columns: ['Кандидат', 'Симуляция', 'Отчёт', 'Интервью', 'Сверка', 'Отзыв кандидату'],
    simulation: { 'not-started': 'Не начата', 'in-progress': 'Идёт', completed: 'Пройдена' },
    report: { open: 'Открыть отчёт', waiting: 'После симуляции' },
    interview: { none: 'Ещё не оценено', scored: 'Оценено вслепую', draft: 'Оценено · черновик готов' },
    consistency: { open: 'Открыть сверку', waiting: 'После баллов интервьюера' },
    feedback: { open: 'Посмотреть', waiting: 'После отчёта' },
    candidate: 'Кандидат',
  },
};

/** The commission's home: where every candidate's evidence stands, and what is ready to read. */
export default function CommissionHome() {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const world = useWorld();
  const a = world.candidates.A;
  const all = Object.values(world.candidates);

  // The two checks the quality guard runs on candidate A's interview and on
  // that interviewer's month; both are scripted until #18.
  const qualitySignals = previewInterviewCheck.signals.length + previewCalibrationCheck.signals.length;

  const tiles = [
    { label: text.tiles.simulations, value: `${all.filter((c) => c.simulation === 'completed').length} / 3` },
    { label: text.tiles.reports, value: `${all.filter((c) => c.assessmentReady).length} / 3` },
    { label: text.tiles.interviews, value: `${all.filter((c) => c.scoresSaved).length} / 3` },
    { label: text.tiles.quality, value: String(qualitySignals), note: text.qualityNote, href: '/commission/quality-guard' },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">{text.title}</h1>
        <p className="max-w-3xl text-sm text-text-secondary">{text.lede}</p>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle lg:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <dt className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">{tile.label}</dt>
              <dd className="font-mono text-2xl font-bold tabular-nums text-text-primary">{tile.value}</dd>
              {tile.note ? <dd className="text-[0.72rem] text-text-muted">{tile.note}</dd> : null}
            </>
          );
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className="flex flex-col gap-1 bg-bg-surface px-5 py-4 transition-colors hover:bg-bg-elevated">
              {body}
            </Link>
          ) : (
            <div key={tile.label} className="flex flex-col gap-1 bg-bg-surface px-5 py-4">
              {body}
            </div>
          );
        })}
      </dl>

      {a.assessmentReady ? (
        <NextStep label={text.next} title={text.read.title} body={text.read.body} href="/commission/simulation-report" action={text.read.action} />
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-border-subtle bg-bg-elevated p-5">
          <div className="flex max-w-2xl flex-col gap-1">
            <p className="font-mono text-[0.6rem] tracking-[0.14em] text-text-muted uppercase">{text.next}</p>
            <h2 className="text-base font-bold text-text-primary">{text.wait.title}</h2>
            <p className="text-sm text-text-secondary">{text.wait.body}</p>
          </div>
        </section>
      )}

      <div className="overflow-x-auto rounded-panel border border-border-subtle bg-bg-surface">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {text.columns.map((column) => (
                <th key={column} className="px-4 py-2.5 font-mono text-[0.58rem] font-normal tracking-[0.12em] text-text-muted uppercase">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {(['A', 'B', 'C'] as const).map((code) => {
              const c = world.candidates[code];
              return (
                <tr key={code} className={c.hasData ? '' : 'opacity-60'}>
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    {text.candidate} {code}
                  </td>
                  {c.hasData ? (
                    <>
                      <td className="px-4 py-3">
                        <StatusPill tone={c.simulation === 'completed' ? 'done' : c.simulation === 'in-progress' ? 'active' : 'waiting'}>
                          {text.simulation[c.simulation]}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        {c.assessmentReady ? (
                          <Link href="/commission/simulation-report" className="text-sm font-semibold text-brand-ink hover:underline">
                            {text.report.open}
                          </Link>
                        ) : (
                          <StatusPill tone="locked">{text.report.waiting}</StatusPill>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={c.draftReady || c.scoresSaved ? 'done' : 'waiting'}>
                          {c.draftReady ? text.interview.draft : c.scoresSaved ? text.interview.scored : text.interview.none}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        {c.scoresSaved ? (
                          <Link
                            href={`/commission/consistency/${c.id}`}
                            className="text-sm font-semibold text-brand-ink hover:underline"
                          >
                            {text.consistency.open}
                          </Link>
                        ) : (
                          <StatusPill tone="locked">{text.consistency.waiting}</StatusPill>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.assessmentReady ? (
                          <Link href="/feedback" className="text-sm font-semibold text-brand-ink hover:underline">
                            {text.feedback.open}
                          </Link>
                        ) : (
                          <StatusPill tone="locked">{text.feedback.waiting}</StatusPill>
                        )}
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

      <AccommodationControl />
    </main>
  );
}
