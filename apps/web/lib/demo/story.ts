import type { CandidateCode } from '../home/types';
import type { Copy } from '../i18n/staffLocale';

/**
 * What the presenter says about each synthetic candidate. The candidates
 * themselves — their ids and where they are — come from the API; this is
 * only the pitch's story, in English and Russian. D.R.I.V.E. competency
 * names stay in English in both.
 */
export const stories: Record<CandidateCode, Copy<{ headline: string; summary: string; watchFor: string[] }>> = {
  A: {
    en: {
      headline: 'Strong execution, thin evidence on values',
      summary:
        'Turns a crisis into owners and deadlines without being asked, but says little about why. The report leaves Values-Driven Leadership empty rather than guessing.',
      watchFor: ['Entrepreneurial Execution backed by quotes', 'Values: insufficient evidence, not a low score'],
    },
    ru: {
      headline: 'Сильное исполнение, мало доказательств по ценностям',
      summary:
        'Без просьб раскладывает кризис на владельцев и сроки, но почти не говорит, зачем. Отчёт оставляет Values-Driven Leadership пустым, а не угадывает.',
      watchFor: ['Entrepreneurial Execution с цитатами', 'Values: недостаточно доказательств, а не низкий балл'],
    },
  },
  B: {
    en: {
      headline: 'Clear vision, shaky resilience',
      summary:
        'Sees what sits behind the conflict and keeps the shared goal in view. When the plan breaks, the recovery steps stay vague.',
      watchFor: ['Insightful Vision backed by quotes', 'Disciplined Resilience: a gap the turns show'],
    },
    ru: {
      headline: 'Ясное видение, шаткая устойчивость',
      summary:
        'Видит, что стоит за конфликтом, и держит общую цель. Когда план ломается, шаги восстановления остаются размытыми.',
      watchFor: ['Insightful Vision с цитатами', 'Disciplined Resilience: пробел, который видно по ходам'],
    },
  },
  C: {
    en: {
      headline: 'Contradictions and missing evidence',
      summary:
        'The application and the simulation disagree, and several answers are too thin to score. The brief flags the inconsistency; the report says so plainly.',
      watchFor: ['Inconsistency flags in the brief', 'Several competencies left at insufficient evidence'],
    },
    ru: {
      headline: 'Противоречия и нехватка доказательств',
      summary:
        'Анкета и симуляция расходятся, а несколько ответов слишком скупы для оценки. Бриф отмечает противоречие, отчёт прямо об этом говорит.',
      watchFor: ['Флаги противоречий в брифе', 'Несколько компетенций — «недостаточно доказательств»'],
    },
  },
};

/** The minimal pitch path, in order, and the screen each step opens. */
export const pathSteps: { module: 'M1' | 'M2' | 'M3' | 'M4' | 'M5'; href: string; copy: Copy<{ title: string; note: string }> }[] = [
  {
    module: 'M1',
    href: '/interviewer/brief',
    copy: {
      en: { title: 'Brief', note: 'Questions for the interviewer, each with its source' },
      ru: { title: 'Бриф', note: 'Вопросы для интервьюера, у каждого — источник' },
    },
  },
  {
    module: 'M2',
    href: '/simulation',
    copy: {
      en: { title: 'Simulation', note: 'The candidate leads a work situation in English' },
      ru: { title: 'Симуляция', note: 'Кандидат ведёт рабочую ситуацию на английском' },
    },
  },
  {
    module: 'M3',
    href: '/commission/simulation-report',
    copy: {
      en: { title: 'Report', note: 'D.R.I.V.E. scores with verbatim quotes' },
      ru: { title: 'Отчёт', note: 'Баллы D.R.I.V.E. с дословными цитатами' },
    },
  },
  {
    module: 'M4',
    href: '/interviewer/interview',
    copy: {
      en: { title: 'Interview draft', note: 'Opens only after the interviewer scores' },
      ru: { title: 'Черновик интервью', note: 'Открывается только после оценки интервьюера' },
    },
  },
  {
    module: 'M5',
    href: '/commission/quality-guard',
    copy: {
      en: { title: 'Quality guard', note: 'Question quality and calibration signals' },
      ru: { title: 'Контроль качества', note: 'Сигналы о качестве вопросов и калибровке' },
    },
  },
];
