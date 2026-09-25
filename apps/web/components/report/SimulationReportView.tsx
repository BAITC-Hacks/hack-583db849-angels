'use client';

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { SimulationReport } from '../../lib/report/types';
import { CompetencyScore } from '../evidence/CompetencyScore';
import { EnglishMetricsPanel } from '../evidence/EnglishMetricsPanel';
import { DriveOverview } from './DriveOverview';
import { InterviewQuestions } from './InterviewQuestions';
import { ReportTranscript } from './ReportTranscript';

const copy = {
  en: {
    eyebrow: 'Simulation report',
    candidate: 'Candidate',
    scenario: 'Scenario',
    mode: 'Mode',
    modes: { text: 'Text', voice: 'Voice' },
    accommodation: 'Text, switched on by staff',
    duration: 'Duration',
    minutes: 'min',
    turns: 'Candidate turns',
    completed: 'Completed',
    note: 'This report supports a human decision and makes none. Scores are 0–4 per competency; where the evidence is missing, it says so.',
    evidence: 'Evidence by competency',
    feedbackTitle: 'What the candidate receives',
    feedbackBody: 'Developmental notes in English, without scores or any hint of a decision.',
    feedbackLink: 'Open the candidate page',
  },
  ru: {
    eyebrow: 'Отчёт по симуляции',
    candidate: 'Кандидат',
    scenario: 'Сценарий',
    mode: 'Режим',
    modes: { text: 'Текст', voice: 'Голос' },
    accommodation: 'Текст, включён сотрудниками',
    duration: 'Длительность',
    minutes: 'мин',
    turns: 'Ходов кандидата',
    completed: 'Завершено',
    note: 'Отчёт помогает человеку принять решение и сам его не принимает. Баллы 0–4 по каждой компетенции; где доказательств нет, так и написано.',
    evidence: 'Доказательства по компетенциям',
    feedbackTitle: 'Что получит кандидат',
    feedbackBody: 'Развивающие заметки на английском — без баллов и намёков на решение.',
    feedbackLink: 'Открыть страницу кандидата',
  },
};

/**
 * M3 for the commission: D.R.I.V.E. scores with the quotes behind them, the
 * transcript every quote links into, English measured apart, and questions
 * for the live interview.
 */
export function SimulationReportView({ report }: { report: SimulationReport }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const candidateTurns = report.turns.filter((turn) => turn.speaker === 'candidate').length;
  const completed = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(
    new Date(report.completedAt),
  );

  const meta = [
    { label: text.scenario, value: report.scenarioTitle },
    { label: text.mode, value: report.accommodation ? text.accommodation : text.modes[report.mode] },
    { label: text.duration, value: `${report.durationMinutes} ${text.minutes}` },
    { label: text.turns, value: String(candidateTurns) },
    { label: text.completed, value: `${completed} UTC` },
  ];

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.eyebrow}</p>
        <h1 className="text-balance-tight text-2xl font-extrabold sm:text-3xl">
          {text.candidate} {report.candidate.code}
        </h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {meta.map((item) => (
            <div key={item.label} className="flex flex-col">
              <dt className="font-mono text-[0.56rem] tracking-[0.12em] text-text-muted uppercase">{item.label}</dt>
              <dd className="text-sm text-text-primary">{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="max-w-3xl border-l-2 border-brand-green pl-3 text-sm text-text-secondary">{text.note}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-4">
          <DriveOverview scores={report.scores} />

          <h2 className="mt-2 font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.evidence}</h2>
          {report.scores.map((item) => (
            <CompetencyScore key={item.competency} id={`competency-${item.competency}`} {...item} />
          ))}

          <InterviewQuestions questions={report.interviewQuestions} />
          <EnglishMetricsPanel metrics={report.english} />

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border-subtle bg-bg-elevated p-5">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{text.feedbackTitle}</h2>
              <p className="text-[0.8rem] text-text-secondary">{text.feedbackBody}</p>
            </div>
            <Link
              href={`/feedback/${report.assessmentId}`}
              className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-surface"
            >
              {text.feedbackLink}
              <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>

        <div className="lg:sticky lg:top-6">
          <ReportTranscript turns={report.turns} characterName={report.characterName} candidateCode={report.candidate.code} />
        </div>
      </div>
    </main>
  );
}
