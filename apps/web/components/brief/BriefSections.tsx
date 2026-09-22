'use client';

import { AcademicCapIcon, ArrowsRightLeftIcon, LanguageIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { competencies } from '../../lib/drive';
import { useStaffLocale } from '../../lib/i18n/StaffLocaleProvider';
import type { BriefConsistencyItem, BriefEvidence, BriefFocus, InterviewerBrief } from '../../lib/brief/types';
import type { StaffLocale } from '../../lib/i18n/staffLocale';
import { EvidenceQuote } from '../evidence/EvidenceQuote';

const copy = {
  en: {
    questions: 'Questions to ask',
    why: 'Why',
    silent: 'Asked because the application says nothing here.',
    consistency: 'Claimed, and what was measured',
    consistencyNote: 'Not a verdict: something to check in the interview.',
    claim: 'The candidate says',
    observation: 'What we see',
    ask: 'Ask',
    whatToDo: 'What to do',
    clarify: 'Topics to clarify',
    english: 'English gap',
    certificate: 'Certificate',
    noCertificate: 'None on file',
    written: 'Written answers',
    englishNote: 'Judged separately: English never moves a D.R.I.V.E. score. Start with an easy question and listen for a minute.',
    status: {
      discrepancy: 'Does not match',
      unverified: 'Not verified',
      consistent: 'Matches',
      confirmed: 'Confirmed in the interview',
      resolved: 'Cleared up in the interview',
    },
    focus: { invision_knowledge: 'inVision U', english: 'English', motivation: 'Motivation' },
    topic: {
      english: 'English',
      invision_knowledge: 'inVision U',
      motivation: 'Motivation',
      experience: 'Experience',
      achievements: 'Achievements',
      other: 'Other',
    },
  },
  ru: {
    questions: 'Вопросы, которые стоит задать',
    why: 'Почему',
    silent: 'Задаётся, потому что анкета об этом молчит.',
    consistency: 'Что заявлено и что измерено',
    consistencyNote: 'Не вердикт: то, что стоит проверить на интервью.',
    claim: 'Кандидат говорит',
    observation: 'Что видим',
    ask: 'Спросите',
    whatToDo: 'Что сделать',
    clarify: 'Темы для уточнения',
    english: 'Разрыв по английскому',
    certificate: 'Сертификат',
    noCertificate: 'Нет в деле',
    written: 'Письменные ответы',
    englishNote: 'Оценивается отдельно: английский никогда не влияет на баллы D.R.I.V.E. Начните с простого вопроса и послушайте минуту.',
    status: {
      discrepancy: 'Не сходится',
      unverified: 'Не проверено',
      consistent: 'Сходится',
      confirmed: 'Подтвердилось на интервью',
      resolved: 'Снялось на интервью',
    },
    focus: { invision_knowledge: 'inVision U', english: 'Английский', motivation: 'Мотивация' },
    topic: {
      english: 'Английский',
      invision_knowledge: 'inVision U',
      motivation: 'Мотивация',
      experience: 'Опыт',
      achievements: 'Достижения',
      other: 'Другое',
    },
  },
};

/** Evidence in the brief points into the sources panel beside it. */
function Quote({ item }: { item: BriefEvidence }) {
  return <EvidenceQuote quote={item.quote} source={item.source} href={`#source-${item.source.id}`} />;
}

/**
 * A D.R.I.V.E. letter is a scored competency, so it keeps its letter and its
 * rubric name. The three other focuses are not scored at all — they are things
 * the interviewer has to settle — so they are marked with an icon instead,
 * which also stops anyone reading them as a sixth competency.
 */
const focusIcon = {
  invision_knowledge: AcademicCapIcon,
  english: LanguageIcon,
  motivation: SparklesIcon,
} as const;

function focusName(focus: BriefFocus, locale: StaffLocale): { letter: string | null; Icon: typeof AcademicCapIcon | null; name: string } {
  if (focus === 'invision_knowledge' || focus === 'english' || focus === 'motivation') {
    return { letter: null, Icon: focusIcon[focus], name: copy[locale].focus[focus] };
  }
  return { letter: focus, Icon: null, name: competencies[focus].name };
}

export function BriefQuestions({ questions }: { questions: InterviewerBrief['questions'] }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  return (
    <section aria-labelledby="questions-title" className="flex flex-col gap-3">
      <h2 id="questions-title" className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
        {text.questions}
      </h2>
      {questions.map((item) => {
        const { letter, Icon, name } = focusName(item.focus, locale);
        return (
          <article key={item.question} className="flex flex-col gap-3 rounded-panel border border-border-subtle bg-bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-bg-elevated font-mono text-sm font-bold text-text-primary">
                {letter ?? (Icon ? <Icon aria-hidden="true" className="h-4 w-4" /> : null)}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-mono text-[0.6rem] tracking-[0.12em] text-text-muted uppercase">{name}</p>
                <p className="text-[0.95rem] font-medium text-text-primary">{item.question}</p>
                <p className="text-[0.8rem] text-text-muted">
                  {text.why}: {item.why}
                </p>
              </div>
            </div>
            {item.evidence.length > 0 ? (
              <div className="flex flex-col gap-3 pl-11">
                {item.evidence.map((evidence) => (
                  <Quote key={evidence.quote} item={evidence} />
                ))}
              </div>
            ) : (
              <p className="ml-11 rounded-control bg-bg-elevated px-3 py-2 text-[0.8rem] text-text-secondary">{text.silent}</p>
            )}
          </article>
        );
      })}
    </section>
  );
}

/**
 * The before-interview stage of the consistency layer: what the candidate said
 * about themselves against what the application, the test and the simulation's
 * speech actually show. Each item ends in a question, so the interviewer can
 * settle it with the person in front of them instead of guessing.
 */
export function BriefConsistency({ items }: { items: BriefConsistencyItem[] }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  return (
    <section aria-labelledby="consistency-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="consistency-title" className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
          {text.consistency}
        </h2>
        <p className="text-[0.75rem] text-text-muted">{text.consistencyNote}</p>
      </div>

      {items.map((item) => (
        <article
          key={item.itemId}
          className={`flex flex-col gap-3 rounded-panel border bg-bg-surface p-5 ${
            item.status === 'discrepancy' ? 'border-status-flag/35' : 'border-border-subtle'
          }`}
        >
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
            <ArrowsRightLeftIcon aria-hidden="true" className="h-4 w-4 text-status-flag" />
            {text.topic[item.topic]}
            <span className="rounded-control bg-bg-elevated px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">
              {text.status[item.status]}
            </span>
          </h3>

          <div className="grid items-start gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{text.claim}</p>
              <p className="text-sm text-text-primary">{item.claim.text}</p>
              {item.claim.evidence.map((evidence) => (
                <Quote key={evidence.quote} item={evidence} />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{text.observation}</p>
              <p className="text-sm text-text-primary">{item.observation.text}</p>
              {item.observation.metric ? (
                <p className="w-fit rounded-control bg-bg-elevated px-2.5 py-1 font-mono text-[0.68rem] text-text-secondary">
                  {item.observation.metric.name}: {item.observation.metric.value} · {item.observation.metric.source}
                </p>
              ) : null}
              {item.observation.evidence.map((evidence) => (
                <Quote key={evidence.quote} item={evidence} />
              ))}
            </div>
          </div>

          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{text.whatToDo}:</span> {item.whatToDo}
          </p>
          {item.askInInterview ? (
            <p className="rounded-control border-l-2 border-brand-green bg-bg-elevated px-3 py-2 text-sm text-text-primary">
              <span className="font-semibold">{text.ask}:</span> {item.askInInterview}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function BriefClarify({ items }: { items: InterviewerBrief['clarify'] }) {
  const { locale } = useStaffLocale();

  return (
    <section aria-labelledby="clarify-title" className="rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h2 id="clarify-title" className="text-sm font-semibold text-text-primary">
        {copy[locale].clarify}
      </h2>
      <ul className="mt-3 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.topic} className="flex flex-col gap-2">
            <p className="text-sm text-text-primary">{item.topic}</p>
            {item.evidence.map((evidence) => (
              <Quote key={evidence.quote} item={evidence} />
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BriefEnglish({ english }: { english: InterviewerBrief['english'] }) {
  const { locale } = useStaffLocale();
  const text = copy[locale];

  return (
    <section aria-labelledby="english-gap-title" className="rounded-panel border border-border-subtle bg-bg-surface p-5">
      <h2 id="english-gap-title" className="text-sm font-semibold text-text-primary">
        {text.english}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-border-subtle bg-border-subtle">
        <div className="flex flex-col gap-0.5 bg-bg-base px-3 py-2.5">
          <dt className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{text.certificate}</dt>
          <dd className="font-mono text-sm font-semibold text-text-primary">
            {english.certificate ? `${english.certificate.type} ${english.certificate.score} · ${english.certificate.cefr}` : text.noCertificate}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 bg-bg-base px-3 py-2.5">
          <dt className="font-mono text-[0.58rem] tracking-[0.1em] text-text-muted uppercase">{text.written}</dt>
          <dd className="font-mono text-sm font-semibold text-text-primary">{english.writtenCefr}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[0.8rem] text-text-secondary">{english.basis}</p>
      <p className="mt-2 text-[0.75rem] text-text-muted">{text.englishNote}</p>
    </section>
  );
}
