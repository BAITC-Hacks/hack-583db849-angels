/**
 * The D.R.I.V.E. competencies as the screens name them (docs/PLAN.md, section 2).
 *
 * Display text only. What each competency looks for, what counts as evidence
 * and what may never be inferred live in config/rubric.drive.json, which the
 * ML service reads; nothing here takes part in scoring.
 */
import type { Copy } from './i18n/staffLocale';

export type Competency = 'D' | 'R' | 'I' | 'V' | 'E';

export const competencyOrder: Competency[] = ['D', 'R', 'I', 'V', 'E'];

/** Names are the rubric's own and stay English in both staff languages; the explanation is translated. */
export const competencies: Record<Competency, { name: string; looksFor: Copy<string> }> = {
  D: {
    name: 'Disciplined Resilience',
    looksFor: {
      en: 'How they respond to failure, recover and keep going step by step',
      ru: 'Как реагирует на неудачу, восстанавливается и идёт дальше шаг за шагом',
    },
  },
  R: {
    name: 'Responsible Innovation',
    looksFor: {
      en: 'Initiative that weighs risks, consequences and ownership',
      ru: 'Инициатива, в которой взвешены риски, последствия и ответственность',
    },
  },
  I: {
    name: 'Insightful Vision',
    looksFor: {
      en: 'Reading the context, thinking long-term, holding a clear goal',
      ru: 'Понимает контекст, думает вдолгую, держит ясную цель',
    },
  },
  V: {
    name: 'Values-Driven Leadership',
    looksFor: {
      en: 'Decisions grounded in values, respect for people, ethical limits',
      ru: 'Решения на основе ценностей, уважение к людям, этические границы',
    },
  },
  E: {
    name: 'Entrepreneurial Execution',
    looksFor: {
      en: 'From idea to action: priorities, owners, deadlines, results',
      ru: 'От идеи к действию: приоритеты, владельцы, сроки, результат',
    },
  },
};
