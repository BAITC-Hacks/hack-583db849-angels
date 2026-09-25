import { previewLines, previewScenario } from '../simulation/previewScenario';
import type { SimulationTurn } from '../simulation/types';
import type { CandidateFeedback, SimulationReport } from './types';

/**
 * Candidate A played the conflict scenario: strong on execution, silent on
 * values (docs/PLAN.md, section 6). Scripted until the judge exists (#10).
 *
 * Every quote below appears word for word in the turn it cites — a test
 * checks it, as the real evidence check will.
 */
const candidateTurns = [
  "Okay, let's fix this fast. The demo is in three days, so we can't lose you now. Send me the list of what Timur changed and I'll look at it tonight.",
  "From now on nobody merges into someone else's module without a review from its owner. I'll set that rule in the repo today.",
  "We keep your version for the demo because it works. Timur moves his changes to a separate branch and we look at them after Thursday. If his login fix is really needed, the risk is that we demo with a known bug, so I'll ask him to patch only that.",
  'Today you finish the payment endpoint, Timur fixes the login in his branch, and I write the demo script. We freeze the backend by Thursday noon and do a full run at six.',
  "Deal. I'll put the owners in the team chat in ten minutes and call Timur right after. If the Thursday run fails, we cut the analytics screen instead of working all night.",
];

const turns: SimulationTurn[] = previewLines.flatMap((line, index) => {
  const character: SimulationTurn = { turnId: '', speaker: 'character', text: line };
  const candidate = candidateTurns[index];
  return candidate ? [character, { turnId: '', speaker: 'candidate' as const, text: candidate }] : [character];
}).map((turn, index) => ({ ...turn, turnId: `turn_${String(index + 1).padStart(2, '0')}` }));

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const candidateWords = candidateTurns.map(words);

export const previewReport: SimulationReport = {
  assessmentId: 'preview',
  candidate: { id: '00000000-0000-4000-8000-00000000000a', code: 'A' },
  scenarioTitle: previewScenario.title,
  mode: 'voice',
  completedAt: '2026-09-25T10:11:50Z',
  durationMinutes: 7,
  turns,
  scores: [
    {
      competency: 'D',
      score: 2,
      confidence: 'medium',
      rationale: 'Has a fallback if the run fails, but says nothing about how the team recovers from the conflict itself.',
      evidence: [
        {
          quote: 'If the Thursday run fails, we cut the analytics screen instead of working all night.',
          source: { kind: 'simulation_turn', id: 'turn_10' },
        },
      ],
    },
    {
      competency: 'R',
      score: 2,
      confidence: 'low',
      rationale: 'Names one risk and a way to contain it; does not weigh what the decision costs the people involved.',
      evidence: [
        {
          quote: "the risk is that we demo with a known bug, so I'll ask him to patch only that.",
          source: { kind: 'simulation_turn', id: 'turn_06' },
        },
      ],
    },
    {
      competency: 'I',
      score: 2,
      confidence: 'medium',
      rationale: 'Sees the process gap behind the conflict, and treats it purely as a process problem.',
      evidence: [
        {
          quote: "nobody merges into someone else's module without a review from its owner",
          source: { kind: 'simulation_turn', id: 'turn_04' },
        },
      ],
    },
    { competency: 'V', score: null, evidence: [] },
    {
      competency: 'E',
      score: 4,
      confidence: 'high',
      rationale: 'Turns the conflict into owners, deadlines and a checkpoint without being asked, and starts acting at once.',
      evidence: [
        {
          quote: 'Today you finish the payment endpoint, Timur fixes the login in his branch, and I write the demo script.',
          source: { kind: 'simulation_turn', id: 'turn_08' },
        },
        {
          quote: 'We freeze the backend by Thursday noon and do a full run at six.',
          source: { kind: 'simulation_turn', id: 'turn_08' },
        },
        {
          quote: "I'll put the owners in the team chat in ten minutes and call Timur right after.",
          source: { kind: 'simulation_turn', id: 'turn_10' },
        },
      ],
    },
  ],
  english: {
    cefrEstimate: 'B2',
    // Spoken, so every measure exists. Only an accommodated text simulation
    // leaves the speech ones null.
    wordsPerMinute: 112,
    fillerRate: 0.03,
    meanTurnLength: candidateWords.reduce((sum, count) => sum + count, 0) / candidateWords.length,
    lexicalDiversity: 0.71,
    grammarErrorsPer100Words: 0.8,
  },
  interviewQuestions: [
    {
      competency: 'V',
      question: 'Tell me about a decision where doing the right thing cost you or your team something. What did you do?',
      reason: 'No verified evidence for Values-Driven Leadership in the simulation.',
    },
    {
      competency: 'D',
      question:
        'The Thursday run fails and the analytics screen is already cut. What happens next, and how do you keep the team together?',
      reason: 'A fallback was named, but not how the team recovers.',
    },
    {
      competency: 'R',
      question: 'What could go wrong with the new review rule, and for whom?',
      reason: 'One risk was named; its effect on people was not.',
    },
  ],
};

export const previewFeedback: CandidateFeedback = {
  assessmentId: 'preview',
  scenarioTitle: previewScenario.title,
  strengths: [
    'You turned a tense moment into a concrete plan: who does what, and by when.',
    'You named a risk in your own plan and a way to keep it small.',
    'You acted straight away instead of waiting for the conflict to settle by itself.',
  ],
  growth: [
    'Say why a decision is fair to everyone involved, not only how it gets the work done.',
    'When a plan might not work out, talk about how the team will get through it together, not only what you will cut.',
  ],
  nextTime: [
    'Before you propose a plan, ask the other person what matters most to them.',
    'After a conflict, check in with each person once the pressure is off.',
  ],
};

/** Stand-ins for the API: any id returns the preview until the assessments endpoint exists. */
export function getReport(assessmentId: string): SimulationReport {
  void assessmentId;
  return previewReport;
}

export function getFeedback(assessmentId: string): CandidateFeedback {
  void assessmentId;
  return previewFeedback;
}
