import type { ScenarioBrief, SimulationStage, SimulationState, SimulationTurn } from './types';

export const MAX_TURN_LENGTH = 1000;

/** How long the scripted character "thinks". The real target is under three seconds a turn. */
const REPLY_DELAY_MS = 1400;

/**
 * Plays a scenario without a server, so the screen can be built before the
 * simulations API exists. It keeps the rules the real one will enforce: one
 * turn in flight at a time, no empty turns, turn ids assigned in order, and a
 * candidate who can stop whenever they like.
 *
 * Like the real beat engine, it ends when the story does: the script runs out
 * before `maxCandidateTurns`, which is only the cap.
 */
export class PreviewSimulation {
  private state: SimulationState;
  private readonly listeners = new Set<() => void>();
  private pending: ReturnType<typeof setTimeout> | null = null;
  private nextLine = 1;

  constructor(
    private readonly scenario: ScenarioBrief,
    private readonly lines: string[],
    private readonly delayMs = REPLY_DELAY_MS,
  ) {
    this.state = {
      stage: 'opening',
      turns: [{ turnId: turnId(1), speaker: 'character', text: lines[0] }],
      replying: false,
      candidateTurns: 0,
      ending: null,
    };
  }

  getSnapshot = (): SimulationState => this.state;

  /** The candidate turn the closing line answers: the script's end, or the cap if it comes first. */
  private get lastTurn(): number {
    return Math.min(this.scenario.maxCandidateTurns, this.lines.length - 1);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Returns false, and changes nothing, when the turn cannot be taken. */
  send(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_TURN_LENGTH) return false;
    if (this.state.replying || this.state.stage === 'finished') return false;

    const candidateTurns = this.state.candidateTurns + 1;
    this.update({
      turns: [...this.state.turns, this.turn('candidate', trimmed)],
      replying: true,
      candidateTurns,
      stage: stageFor(candidateTurns, this.lastTurn),
    });

    this.pending = setTimeout(() => {
      this.pending = null;
      const last = candidateTurns >= this.lastTurn;
      const line = last ? this.lines[this.lines.length - 1] : this.lines[Math.min(this.nextLine, this.lines.length - 2)];
      this.nextLine += 1;

      this.update({
        turns: [...this.state.turns, this.turn('character', line)],
        replying: false,
        ...(last ? { stage: 'finished' as const, ending: 'completed' as const } : {}),
      });
    }, this.delayMs);

    return true;
  }

  /** The candidate may stop at any moment, including while the character is replying. */
  stop(): void {
    if (this.state.stage === 'finished') return;
    if (this.pending) clearTimeout(this.pending);
    this.pending = null;
    this.update({ stage: 'finished', replying: false, ending: 'stopped' });
  }

  dispose(): void {
    if (this.pending) clearTimeout(this.pending);
    this.listeners.clear();
  }

  private turn(speaker: SimulationTurn['speaker'], text: string): SimulationTurn {
    return { turnId: turnId(this.state.turns.length + 1), speaker, text };
  }

  private update(patch: Partial<SimulationState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}

function turnId(position: number): string {
  return `turn_${String(position).padStart(2, '0')}`;
}

function stageFor(candidateTurns: number, max: number): SimulationStage {
  if (candidateTurns >= max - 1) return 'wrapping-up';
  return candidateTurns === 0 ? 'opening' : 'in-progress';
}
