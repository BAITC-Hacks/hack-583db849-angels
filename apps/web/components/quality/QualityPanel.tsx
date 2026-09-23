'use client';

import { ChatBubbleLeftRightIcon, ExclamationTriangleIcon, NoSymbolIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { competencies, competencyOrder, type Competency } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { QualityCheck, QualitySignal, QualitySignalKind } from '../../lib/quality/types';
import { EvidenceQuote } from '../evidence/EvidenceQuote';

const copy = {
  en: {
    signals: 'Signals',
    recommendation: 'What to do',
    talkShare: 'Who spoke',
    interviewer: 'Interviewer',
    candidate: 'Candidate',
    talkNote: 'An interviewer who holds most of the time hears least of the candidate.',
    coverage: 'D.R.I.V.E. coverage',
    coverageNote: 'Which competencies the questions actually reached.',
    covered: 'Asked about',
    missed: 'Not reached',
    drift: 'Scale against the panel',
    driftNote: (interviews: number) => `Mean score per competency over ${interviews} interviews in the period.`,
    columns: ['Competency', 'This interviewer', 'Panel', 'Difference'],
    kind: {
      leading_question: 'Leading question',
      off_limits_question: 'Question that may not be asked',
      coverage_gap: 'Competency not reached',
      scale_drift: 'Scale drift',
    } satisfies Record<QualitySignalKind, string>,
    none: 'No signals in this check.',
  },
  ru: {
    signals: 'Сигналы',
    recommendation: 'Что сделать',
    talkShare: 'Кто говорил',
    interviewer: 'Интервьюер',
    candidate: 'Кандидат',
    talkNote: 'Интервьюер, который держит большую часть времени, меньше всего слышит кандидата.',
    coverage: 'Покрытие D.R.I.V.E.',
    coverageNote: 'Каких компетенций вопросы действительно коснулись.',
    covered: 'Спросили',
    missed: 'Не дошли',
    drift: 'Шкала против панели',
    driftNote: (interviews: number) => `Средний балл по компетенции за ${interviews} интервью периода.`,
    columns: ['Компетенция', 'Этот интервьюер', 'Панель', 'Разница'],
    kind: {
      leading_question: 'Наводящий вопрос',
      off_limits_question: 'Вопрос, который нельзя задавать',
      coverage_gap: 'Компетенция не затронута',
      scale_drift: 'Сдвиг шкалы',
    } satisfies Record<QualitySignalKind, string>,
    none: 'В этой проверке сигналов нет.',
  },
};

const signalIcon: Record<QualitySignalKind, typeof ExclamationTriangleIcon> = {
  leading_question: ExclamationTriangleIcon,
  off_limits_question: NoSymbolIcon,
  coverage_gap: ChatBubbleLeftRightIcon,
  scale_drift: ScaleIcon,
};

function SignalCard({ signal }: { signal: QualitySignal }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const Icon = signalIcon[signal.kind];

  return (
    <article className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
        <Icon aria-hidden="true" className="h-4 w-4 text-status-flag" />
        {text.kind[signal.kind]}
        {signal.competencies.map((competency) => (
          <span
            key={competency}
            className="rounded-control bg-bg-elevated px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase"
          >
            {competency} · {competencies[competency].name}
          </span>
        ))}
      </h3>

      <p className="text-sm text-text-primary">{signal.message}</p>

      {signal.evidence.map((evidence) => (
        <EvidenceQuote key={evidence.quote} quote={evidence.quote} source={evidence.source} />
      ))}

      <p className="text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">{text.recommendation}:</span> {signal.recommendation}
      </p>
    </article>
  );
}

function TalkShare({ share }: { share: NonNullable<QualityCheck['talkShare']> }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const interviewer = Math.round(share.interviewer * 100);

  return (
    <section className="flex flex-col gap-2 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary">{text.talkShare}</h2>
      <div className="flex h-3 overflow-hidden rounded-control bg-bg-elevated" aria-hidden="true">
        <div className="bg-chip-sky" style={{ width: `${interviewer}%` }} />
        <div className="bg-brand-green" style={{ width: `${100 - interviewer}%` }} />
      </div>
      <p className="font-mono text-[0.68rem] tabular-nums text-text-secondary">
        {text.interviewer} {interviewer}% · {text.candidate} {100 - interviewer}%
      </p>
      <p className="text-[0.75rem] text-text-muted">{text.talkNote}</p>
    </section>
  );
}

/** Coverage is read off the check's own gap signals: what they name is what the questions never reached. */
function Coverage({ missed }: { missed: Competency[] }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary">{text.coverage}</h2>
      <ul className="flex flex-wrap gap-2">
        {competencyOrder.map((competency) => {
          const reached = !missed.includes(competency);
          return (
            <li
              key={competency}
              className={`rounded-control px-2.5 py-1 font-mono text-[0.62rem] tracking-[0.1em] uppercase ${
                reached ? 'bg-bg-elevated text-text-secondary' : 'bg-status-flag/15 text-text-primary'
              }`}
            >
              {competency} · {reached ? text.covered : text.missed}
            </li>
          );
        })}
      </ul>
      <p className="text-[0.75rem] text-text-muted">{text.coverageNote}</p>
    </section>
  );
}

function Drift({ check }: { check: QualityCheck }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary">{text.drift}</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border-subtle">
            {text.columns.map((column) => (
              <th key={column} className="py-2 font-mono text-[0.58rem] font-normal tracking-[0.12em] text-text-muted uppercase">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {check.drift.map((row) => (
            <tr key={row.competency}>
              <td className="py-2 font-semibold text-text-primary">
                {row.competency} · {competencies[row.competency].name}
              </td>
              <td className="py-2 font-mono tabular-nums text-text-primary">{row.interviewerMean.toFixed(1)}</td>
              <td className="py-2 font-mono tabular-nums text-text-secondary">{row.panelMean.toFixed(1)}</td>
              <td
                className={`py-2 font-mono tabular-nums ${Math.abs(row.delta) >= 0.5 ? 'font-bold text-text-primary' : 'text-text-muted'}`}
              >
                {row.delta > 0 ? '+' : ''}
                {row.delta.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {check.interviews ? <p className="text-[0.75rem] text-text-muted">{text.driftNote(check.interviews)}</p> : null}
    </section>
  );
}

/**
 * One check, as the commission reads it: the numbers that are arithmetic
 * (who spoke, which competencies were reached, how the scale sits against the
 * panel), then the signals with what to do about each.
 */
export function QualityCheckPanel({ check }: { check: QualityCheck }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];
  const missed = check.signals.filter((signal) => signal.kind === 'coverage_gap').flatMap((signal) => signal.competencies);

  return (
    <div className="flex flex-col gap-4">
      {check.talkShare ? <TalkShare share={check.talkShare} /> : null}
      {check.kind === 'interview' ? <Coverage missed={missed} /> : null}
      {check.drift.length > 0 ? <Drift check={check} /> : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">{text.signals}</h2>
        {check.signals.length > 0 ? (
          check.signals.map((signal) => <SignalCard key={signal.message} signal={signal} />)
        ) : (
          <p className="rounded-panel border border-border-subtle bg-bg-surface p-5 text-sm text-text-secondary">{text.none}</p>
        )}
      </section>
    </div>
  );
}
