import type { AssessmentDraft, InterviewTurn, InterviewView, InterviewerScores } from './types';

/**
 * Candidate A's live interview and the draft the service would write from its
 * transcript. Scripted until the interviews API, transcription and the M4
 * model exist (#15, #16). Every quote appears word for word in the candidate
 * turn it cites. Two of the interviewer's questions are there on purpose: the
 * quality guard (M5) flags one as leading and one as off-limits.
 */
export const previewInterview: InterviewView = {
  interviewId: 'preview',
  candidate: { id: '00000000-0000-4000-8000-00000000000a', code: 'A' },
  heldAt: '2026-09-26T09:30:00Z',
};

const lines: [InterviewTurn['speaker'], string, number, number][] = [
  ['interviewer', 'Thanks for coming in. Tell me about the conflict in the simulation. What did you do first?', 5, 12],
  ['candidate', 'I made a plan straight away: owners, a deadline and a full run on Thursday. When a demo is close, speed matters.', 14, 29],
  ['interviewer', 'You would agree that finishing on time matters most, right?', 41, 45],
  ['candidate', 'Yes, finishing on time is what matters for a demo.', 46, 51],
  ['interviewer', "Why did you keep Dana's version?", 58, 61],
  ['candidate', 'It works, and that is what matters for the demo. Timur can bring his changes in later.', 63, 72],
  ['interviewer', 'What do your parents do for a living?', 90, 93],
  ['candidate', 'Sorry, is that part of the interview?', 95, 98],
  ['interviewer', 'Fair point, let me move on. Tell me about a time doing the right thing cost you something.', 99, 106],
  ['candidate', 'I once reported a classmate who copied homework. I felt bad, but rules are rules, so I told the teacher.', 112, 124],
  ['interviewer', 'If the Thursday run fails, what happens next?', 140, 144],
  ['candidate', 'We cut scope and move on. The analytics screen can wait.', 146, 152],
  ['interviewer', 'What could go wrong with the new review rule?', 170, 174],
  ['candidate', 'Merges get slower. I would add a 24-hour limit for reviews so nobody is blocked.', 176, 186],
];

export const previewTranscript: InterviewTurn[] = lines.map(([speaker, text, startSec, endSec], index) => ({
  turnId: `iturn_${String(index + 1).padStart(2, '0')}`,
  speaker,
  text,
  startSec,
  endSec,
}));

export const previewDraft: AssessmentDraft = {
  scores: [
    {
      competency: 'D',
      score: 2,
      confidence: 'medium',
      rationale: 'Recovery is framed as cutting scope; the team itself does not come into it.',
      evidence: [{ quote: 'We cut scope and move on.', source: { kind: 'interview_turn', id: 'iturn_12' } }],
    },
    {
      competency: 'R',
      score: 3,
      confidence: 'medium',
      rationale: 'Names a cost of their own rule and proposes a concrete limit for it.',
      evidence: [
        {
          quote: 'I would add a 24-hour limit for reviews so nobody is blocked.',
          source: { kind: 'interview_turn', id: 'iturn_14' },
        },
      ],
    },
    { competency: 'I', score: null, evidence: [] },
    {
      competency: 'V',
      score: 2,
      confidence: 'low',
      rationale: 'One story, where following the rule outweighs the person; fairness to the teammate is not raised.',
      evidence: [
        { quote: 'I felt bad, but rules are rules, so I told the teacher.', source: { kind: 'interview_turn', id: 'iturn_10' } },
        { quote: 'It works, and that is what matters for the demo.', source: { kind: 'interview_turn', id: 'iturn_06' } },
      ],
    },
    {
      competency: 'E',
      score: 4,
      confidence: 'high',
      rationale: 'Restates a complete plan with owners and a checkpoint, unprompted.',
      evidence: [
        {
          quote: 'I made a plan straight away: owners, a deadline and a full run on Thursday.',
          source: { kind: 'interview_turn', id: 'iturn_02' },
        },
      ],
    },
  ],
};

/** A plausible interviewer view, for filling the form quickly during a demo. */
export const sampleScores: InterviewerScores = { D: 3, R: 2, I: 2, V: null, E: 3 };
