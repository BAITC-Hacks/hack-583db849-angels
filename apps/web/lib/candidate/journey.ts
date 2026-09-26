import type { WireCandidateProgress } from '../api/contract';

type Progress = WireCandidateProgress;

export type TaskState = 'done' | 'started' | 'todo';

export interface Task {
  /** The id of the step's card on the candidate home, for a link straight to it. */
  anchor: string;
  title: string;
  state: TaskState;
  /** Roughly how long the candidate spends on it, for "time left". */
  minutes: number;
}

/**
 * How long the admissions committee usually takes after the interview.
 * inVision U sets this; it is a promise about time, never about the outcome.
 */
export const DECISION_WAIT_WEEKS = 2;

/**
 * What the candidate still has to do, in the order the home suggests. Only
 * the candidate's own tasks count towards "done": the feedback and the
 * decision are people's work, not theirs.
 */
export function candidateTasks(progress: Progress | null | undefined): Task[] {
  const simulation = progress?.simulation ?? null;
  const surprise = progress?.surprise?.status ?? null;
  const slot = progress?.interviewSlot?.status ?? null;
  return [
    {
      anchor: 'step-simulation',
      title: 'The simulation',
      state: simulation?.status === 'completed' ? 'done' : simulation ? 'started' : 'todo',
      minutes: 8,
    },
    {
      anchor: 'step-question',
      title: 'A short question',
      // An expired question is over too: there is nothing left to do on it.
      state:
        surprise === 'transcribing' || surprise === 'answered' || surprise === 'failed' || surprise === 'expired'
          ? 'done'
          : surprise === 'started'
            ? 'started'
            : 'todo',
      minutes: 2,
    },
    {
      anchor: 'step-presentation',
      title: 'Your presentation',
      state: progress?.presentation ? 'done' : 'todo',
      minutes: 5,
    },
    {
      anchor: 'step-interview',
      title: 'Your interview',
      state: slot === 'done' ? 'done' : slot === 'booked' || slot === 'waiting' || slot === 'live' ? 'started' : 'todo',
      minutes: 30,
    },
  ];
}

/** Whole days from one Almaty day to another, for "in 3 days". */
export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
}
