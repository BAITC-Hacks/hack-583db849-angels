import type { Copy } from '../i18n/staffLocale';

/**
 * The demo: three synthetic candidates and the path each one walks
 * (docs/PLAN.md, sections 6 and 8).
 *
 * The candidate ids are fixed in docs/SPEC.md, section 8, so web, api, ml and
 * the seed files all mean the same person. Until the API serves candidates,
 * the list lives here. This is staff-facing text, so it exists in English and
 * Russian; D.R.I.V.E. competency names stay in English in both.
 */
export interface DemoCandidate {
  id: string;
  code: 'A' | 'B' | 'C';
  copy: Copy<{
    headline: string;
    summary: string;
    /** What the presenter points at when this candidate is on screen. */
    watchFor: string[];
  }>;
}

export const demoCandidates: DemoCandidate[] = [
  {
    id: '00000000-0000-4000-8000-00000000000a',
    code: 'A',
    copy: {
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
  },
  {
    id: '00000000-0000-4000-8000-00000000000b',
    code: 'B',
    copy: {
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
  },
  {
    id: '00000000-0000-4000-8000-00000000000c',
    code: 'C',
    copy: {
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
  },
];

export interface DemoStep {
  module: 'M1' | 'M2' | 'M3' | 'M4' | 'M5';
  copy: Copy<{ title: string; note: string }>;
  /** Where the step opens for a candidate; absent until its slice lands. */
  href?: (candidateId: string) => string;
  /** A screen on scripted preview data, reachable before the slice lands. */
  preview?: string;
}

/** The minimal pitch path, in order. A step gets an `href` when its slice is merged. */
export const demoSteps: DemoStep[] = [
  {
    module: 'M1',
    preview: '/interviewer/brief/00000000-0000-4000-8000-00000000000a',
    copy: {
      en: { title: 'Brief', note: 'Questions for the interviewer, each with its source' },
      ru: { title: 'Бриф', note: 'Вопросы для интервьюера, у каждого — источник' },
    },
  },
  {
    module: 'M2',
    preview: '/simulation',
    copy: {
      en: { title: 'Simulation', note: 'The candidate leads a work situation in English' },
      ru: { title: 'Симуляция', note: 'Кандидат ведёт рабочую ситуацию на английском' },
    },
  },
  {
    module: 'M3',
    preview: '/commission/simulation-report/preview',
    copy: {
      en: { title: 'Report', note: 'D.R.I.V.E. scores with verbatim quotes' },
      ru: { title: 'Отчёт', note: 'Баллы D.R.I.V.E. с дословными цитатами' },
    },
  },
  {
    module: 'M4',
    preview: '/interviewer/interview/preview',
    copy: {
      en: { title: 'Interview draft', note: 'Opens only after the interviewer scores' },
      ru: { title: 'Черновик интервью', note: 'Открывается только после оценки интервьюера' },
    },
  },
  {
    module: 'M5',
    copy: {
      en: { title: 'Quality guard', note: 'Question quality and calibration signals' },
      ru: { title: 'Контроль качества', note: 'Сигналы о качестве вопросов и калибровке' },
    },
  },
];
