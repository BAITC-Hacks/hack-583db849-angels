import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TURN_LENGTH, PreviewSimulation } from '../lib/simulation/previewDriver';
import { previewLines, previewScenario } from '../lib/simulation/previewScenario';

function start() {
  return new PreviewSimulation(previewScenario, previewLines, 100);
}

describe('preview simulation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens with the character and numbers turns in order', () => {
    const simulation = start();
    expect(simulation.getSnapshot().turns).toEqual([{ turnId: 'turn_01', speaker: 'character', text: previewLines[0] }]);

    simulation.send('Dana, can we talk for a minute?');
    vi.advanceTimersByTime(100);

    expect(simulation.getSnapshot().turns.map((turn) => [turn.turnId, turn.speaker])).toEqual([
      ['turn_01', 'character'],
      ['turn_02', 'candidate'],
      ['turn_03', 'character'],
    ]);
  });

  it('keeps one turn in flight and refuses empty or oversized turns', () => {
    const simulation = start();

    expect(simulation.send('   ')).toBe(false);
    expect(simulation.send('x'.repeat(MAX_TURN_LENGTH + 1))).toBe(false);
    expect(simulation.send('First')).toBe(true);
    expect(simulation.getSnapshot().replying).toBe(true);
    expect(simulation.send('Second, too early')).toBe(false);

    vi.advanceTimersByTime(100);
    expect(simulation.getSnapshot().replying).toBe(false);
    expect(simulation.send('Second')).toBe(true);
  });

  it('completes after the last candidate turn with the closing line', () => {
    const simulation = start();

    for (let turn = 1; turn <= previewScenario.maxCandidateTurns; turn += 1) {
      simulation.send(`Turn ${turn}`);
      vi.advanceTimersByTime(100);
    }

    const state = simulation.getSnapshot();
    expect(state.stage).toBe('finished');
    expect(state.ending).toBe('completed');
    expect(state.turns.at(-1)?.text).toBe(previewLines.at(-1));
    expect(new Set(state.turns.filter((t) => t.speaker === 'character').map((t) => t.text)).size).toBe(
      previewScenario.maxCandidateTurns + 1,
    );
    expect(simulation.send('One more')).toBe(false);
  });

  it('lets the candidate stop mid-reply, and nothing arrives afterwards', () => {
    const simulation = start();
    simulation.send('I think we should pause');
    simulation.stop();
    vi.advanceTimersByTime(1000);

    const state = simulation.getSnapshot();
    expect(state).toMatchObject({ stage: 'finished', ending: 'stopped', replying: false });
    expect(state.turns.at(-1)?.speaker).toBe('candidate');
  });
});
