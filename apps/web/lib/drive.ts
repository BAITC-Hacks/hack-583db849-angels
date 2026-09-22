/**
 * The D.R.I.V.E. competencies as the screens name them (docs/PLAN.md, section 2).
 *
 * Display text only. What each competency looks for, what counts as evidence
 * and what may never be inferred live in config/rubric.drive.json, which the
 * ML service reads; nothing here takes part in scoring.
 */
export type Competency = 'D' | 'R' | 'I' | 'V' | 'E';

export const competencyOrder: Competency[] = ['D', 'R', 'I', 'V', 'E'];

export const competencies: Record<Competency, { name: string; looksFor: string }> = {
  D: { name: 'Disciplined Resilience', looksFor: 'How they respond to failure, recover and keep going step by step' },
  R: { name: 'Responsible Innovation', looksFor: 'Initiative that weighs risks, consequences and ownership' },
  I: { name: 'Insightful Vision', looksFor: 'Reading the context, thinking long-term, holding a clear goal' },
  V: { name: 'Values-Driven Leadership', looksFor: 'Decisions grounded in values, respect for people, ethical limits' },
  E: { name: 'Entrepreneurial Execution', looksFor: 'From idea to action: priorities, owners, deadlines, results' },
};
