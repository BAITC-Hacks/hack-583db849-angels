import type { ScenarioBrief } from './types';

/**
 * A scripted stand-in for the conflict-resolution scenario, so the screen can
 * be built and reviewed before the simulator exists. The real scenario lives in
 * config/scenarios/ (#7) and the real character answers what the candidate
 * actually says; these lines answer in a fixed order, whatever is typed.
 */
export const previewScenario: ScenarioBrief = {
  title: 'A teammate is about to walk away',
  situation:
    'Your team of four is building an app for a city hackathon, and the demo is in three days. Dana wrote most of the backend. Last night Timur rewrote her module without asking, and this morning she says she is out.',
  yourRole: 'You lead the team.',
  goal: 'Get to the demo without losing anyone. There is no single right way to do it.',
  character: {
    name: 'Dana',
    role: 'Backend developer on your team',
    wants: 'To be asked before her work is changed',
  },
  expectedMinutes: 8,
  maxCandidateTurns: 5,
};

/** Dana's lines, in order. Each is under 60 words, as the real character's will be. */
export const previewLines: string[] = [
  "Honestly, I'm done. Timur rewrote my whole module last night without a word to me. If my work can just be thrown away, why am I even here? Maybe the three of you can finish the demo without me.",
  "Okay… I hear you. But it isn't only about the code. Nobody asked me anything. How do I know it won't happen again next week?",
  'Fine, I could talk to him. But the demo is in three days and his version still breaks the login. Who decides which version we keep?',
  "That sounds fair, I guess. So what do I actually do today? I don't want to sit around waiting for Timur to agree with me.",
  "Alright. If we write down who owns what, I'm in. But you tell Timur, not me. I don't want another argument tonight.",
  "Okay. Let's try it your way. And thanks for actually listening.",
];
