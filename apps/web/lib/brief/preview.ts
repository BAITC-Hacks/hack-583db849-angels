import type { InterviewerBrief } from './types';

/**
 * Candidate A before the interview: a synthetic application and test, and the
 * brief the service would write from them. Scripted until the briefs API and
 * the M1 model exist (#12, #13). Every quote appears word for word in the
 * answer or response it cites — a test checks it.
 */
export const previewBrief: InterviewerBrief = {
  candidate: { id: '00000000-0000-4000-8000-00000000000a', code: 'A' },
  application: [
    {
      fieldId: 'motivation',
      question: 'Why inVision U?',
      answer:
        "I want to build products that people in my city actually use. At school I led our robotics team to the regional final, and I always ask everyone's opinion before I decide anything. inVision U is where I can learn to do this at a bigger scale.",
    },
    {
      fieldId: 'leadership_example',
      question: 'Describe a time you led others.',
      answer:
        'I organised a weekend clean-up with twelve volunteers and split them into three teams. Each team had a leader and a list of streets. We finished by two and collected forty bags.',
    },
    {
      fieldId: 'setback',
      question: 'Tell us about something that did not go as planned.',
      answer:
        'Our robot broke two days before the final. We rebuilt the arm overnight and still made it. I learned to always have spare parts.',
    },
    {
      fieldId: 'community',
      question: 'What problem in your community would you like to solve?',
      answer: 'Public transport in Almaty is hard to plan. I want to make an app that shows real bus times.',
    },
  ],
  test: [
    { itemId: 'block_03', response: 'I prefer to decide quickly and explain my reasons later.' },
    { itemId: 'block_07', response: 'When a teammate disagrees, I focus on finishing the task first.' },
  ],
  summary:
    'Concrete, fast execution with numbers and owners. Little about why decisions are fair, or about people after a setback. Written English is clear but simpler than the certificate suggests.',
  questions: [
    {
      competency: 'D',
      question:
        'Your robot broke two days before the final. How was the team feeling, and what did you do for them — not only for the robot?',
      why: 'The setback story is about fixing the machine; how the team came through is missing.',
      evidence: [{ quote: 'We rebuilt the arm overnight and still made it.', source: { kind: 'application_field', id: 'setback' } }],
    },
    {
      competency: 'R',
      question: 'What was the riskiest decision in the clean-up or the final, and what could it have cost?',
      why: 'No answer weighs a risk or its consequences.',
      evidence: [],
    },
    {
      competency: 'I',
      question: 'Why do real bus times matter to the people who would use the app — and who might it leave out?',
      why: 'The idea is clear; the thinking about its users is not.',
      evidence: [
        { quote: 'I want to make an app that shows real bus times.', source: { kind: 'application_field', id: 'community' } },
      ],
    },
    {
      competency: 'V',
      question: 'Tell me about a time doing the right thing slowed you down. What did you choose, and why?',
      why: 'No answer touches values or fairness.',
      evidence: [],
    },
    {
      competency: 'E',
      question: 'Walk me through the clean-up: who chose the streets and the leaders, and what would you change?',
      why: 'Strong execution evidence — confirm the plan was their own.',
      evidence: [
        { quote: 'Each team had a leader and a list of streets.', source: { kind: 'application_field', id: 'leadership_example' } },
      ],
    },
  ],
  flags: [
    {
      title: 'How they make decisions',
      ask: 'Ask for a recent decision and exactly how it was made.',
      sources: [
        { quote: "I always ask everyone's opinion before I decide anything.", source: { kind: 'application_field', id: 'motivation' } },
        { quote: 'I prefer to decide quickly and explain my reasons later.', source: { kind: 'test_item', id: 'block_03' } },
      ],
    },
  ],
  clarify: [
    {
      topic: 'Their own part in the robotics result, apart from the team’s.',
      evidence: [
        { quote: 'I led our robotics team to the regional final', source: { kind: 'application_field', id: 'motivation' } },
      ],
    },
    {
      topic: 'What else changed after the setback, beyond spare parts.',
      evidence: [{ quote: 'I learned to always have spare parts.', source: { kind: 'application_field', id: 'setback' } }],
    },
  ],
  english: {
    certificate: 'IELTS 6.5',
    certificateCefr: 'B2',
    writtenCefr: 'B1+',
    basis: 'Short sentences and a narrow range of vocabulary in the written answers; almost no errors.',
  },
};

/** Stand-in for the API: any candidate returns candidate A until the briefs endpoint exists. */
export function getBrief(candidateId: string): InterviewerBrief {
  void candidateId;
  return previewBrief;
}
