/**
 * The demo: three synthetic candidates and the path each one walks
 * (docs/PLAN.md, sections 6 and 8).
 *
 * The candidate ids are fixed in docs/SPEC.md, section 8, so web, api, ml and
 * the seed files all mean the same person. Until the API serves candidates,
 * the list lives here.
 */
export interface DemoCandidate {
  id: string;
  code: 'A' | 'B' | 'C';
  headline: string;
  summary: string;
  /** What the presenter points at when this candidate is on screen. */
  watchFor: string[];
}

export const demoCandidates: DemoCandidate[] = [
  {
    id: '00000000-0000-4000-8000-00000000000a',
    code: 'A',
    headline: 'Strong execution, thin evidence on values',
    summary:
      'Turns a crisis into owners and deadlines without being asked, but says little about why. The report leaves Values-Driven Leadership empty rather than guessing.',
    watchFor: ['Entrepreneurial Execution backed by quotes', 'Values: insufficient evidence, not a low score'],
  },
  {
    id: '00000000-0000-4000-8000-00000000000b',
    code: 'B',
    headline: 'Clear vision, shaky resilience',
    summary:
      'Sees what sits behind the conflict and keeps the shared goal in view. When the plan breaks, the recovery steps stay vague.',
    watchFor: ['Insightful Vision backed by quotes', 'Disciplined Resilience: a gap the turns show'],
  },
  {
    id: '00000000-0000-4000-8000-00000000000c',
    code: 'C',
    headline: 'Contradictions and missing evidence',
    summary:
      'The application and the simulation disagree, and several answers are too thin to score. The brief flags the inconsistency; the report says so plainly.',
    watchFor: ['Inconsistency flags in the brief', 'Several competencies left at insufficient evidence'],
  },
];

export interface DemoStep {
  module: 'M1' | 'M2' | 'M3' | 'M4' | 'M5';
  title: string;
  note: string;
  /** Where the step opens for a candidate; absent until its slice lands. */
  href?: (candidateId: string) => string;
}

/** The minimal pitch path, in order. A step gets an `href` when its slice is merged. */
export const demoSteps: DemoStep[] = [
  { module: 'M1', title: 'Brief', note: 'Questions for the interviewer, each with its source' },
  { module: 'M2', title: 'Simulation', note: 'The candidate leads a work situation in English' },
  { module: 'M3', title: 'Report', note: 'D.R.I.V.E. scores with verbatim quotes' },
  { module: 'M4', title: 'Interview draft', note: 'Opens only after the interviewer scores' },
  { module: 'M5', title: 'Quality guard', note: 'Question quality and calibration signals' },
];
