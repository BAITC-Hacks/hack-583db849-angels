import type { AssessmentDraft, InterviewView, InterviewerScores } from './types';

/**
 * Candidate A's live interview, as the interviewer noted it, and the draft the
 * service would write from those notes. Scripted until the interviews API and
 * the M4 model exist (#15, #16). Every quote appears word for word in the note
 * it cites.
 */
export const previewInterview: InterviewView = {
  interviewId: 'preview',
  candidate: { id: '00000000-0000-4000-8000-00000000000a', code: 'A' },
  heldAt: '2026-09-26T09:30:00Z',
  notes: [
    {
      id: 'note_1',
      text: 'Asked about the hackathon conflict. Candidate repeated the plan: owners, deadline, full run on Thursday. Very quick to act.',
    },
    {
      id: 'note_2',
      text: "Why keep Dana's version? Said it works, and that is what matters for the demo. Did not mention fairness to Dana.",
    },
    {
      id: 'note_3',
      text: 'Values question (doing the right thing at a cost): reported a classmate who copied homework. Said: I felt bad, but rules are rules.',
    },
    {
      id: 'note_4',
      text: 'If Thursday fails? We cut scope and move on. No word about how people feel afterwards.',
    },
    {
      id: 'note_5',
      text: 'Risks of the new review rule: named slower merges and suggested a 24-hour review limit.',
    },
  ],
};

export const previewDraft: AssessmentDraft = {
  scores: [
    {
      competency: 'D',
      score: 2,
      confidence: 'medium',
      rationale: 'Recovery is framed as cutting scope; the team itself does not come into it.',
      evidence: [{ quote: 'We cut scope and move on.', source: { kind: 'interview_note', id: 'note_4' } }],
    },
    {
      competency: 'R',
      score: 3,
      confidence: 'medium',
      rationale: 'Names a cost of their own rule and proposes a concrete limit for it.',
      evidence: [
        { quote: 'named slower merges and suggested a 24-hour review limit', source: { kind: 'interview_note', id: 'note_5' } },
      ],
    },
    { competency: 'I', score: null, evidence: [] },
    {
      competency: 'V',
      score: 2,
      confidence: 'low',
      rationale: 'One story, where following the rule outweighs the person; fairness to the teammate is not raised.',
      evidence: [
        { quote: 'I felt bad, but rules are rules.', source: { kind: 'interview_note', id: 'note_3' } },
        { quote: 'Did not mention fairness to Dana.', source: { kind: 'interview_note', id: 'note_2' } },
      ],
    },
    {
      competency: 'E',
      score: 4,
      confidence: 'high',
      rationale: 'Restates a complete plan with owners and a checkpoint, unprompted.',
      evidence: [
        {
          quote: 'Candidate repeated the plan: owners, deadline, full run on Thursday.',
          source: { kind: 'interview_note', id: 'note_1' },
        },
      ],
    },
  ],
};

/** A plausible interviewer view, for filling the form quickly during a demo. */
export const sampleScores: InterviewerScores = { D: 3, R: 2, I: 2, V: null, E: 3 };
