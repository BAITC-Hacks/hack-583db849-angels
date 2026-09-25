/**
 * What the simulation screen renders. These are the screen's own shapes, not
 * wire types: once the simulations contract lands (#6), a small mapper turns
 * the generated client's responses into these, and nothing below the hook
 * changes.
 */
export type Speaker = 'candidate' | 'character';

export interface SimulationTurn {
  /** `turn_` plus a two-digit position, as in docs/SPEC.md. */
  turnId: string;
  speaker: Speaker;
  text: string;
}

export type SimulationStage = 'opening' | 'in-progress' | 'wrapping-up' | 'finished';

export interface ScenarioBrief {
  title: string;
  situation: string;
  yourRole: string;
  goal: string;
  character: { name: string; role: string; wants: string };
  /** A soft limit shown to the candidate, not a hard stop. */
  expectedMinutes: number;
  maxCandidateTurns: number;
}

export interface SimulationState {
  stage: SimulationStage;
  turns: SimulationTurn[];
  /** A candidate turn is on its way and the character has not answered yet. */
  replying: boolean;
  candidateTurns: number;
  /** Why the simulation ended, once it has. */
  ending: 'completed' | 'stopped' | null;
}

/** The API refuses a typed turn longer than this (`400`); the field stops first. */
export const MAX_TURN_LENGTH = 1000;
