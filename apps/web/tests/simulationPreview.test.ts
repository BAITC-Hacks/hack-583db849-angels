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

  it('completes when the story does, before the cap, with the closing line', () => {
    const simulation = start();
    const storyTurns = previewLines.length - 1;
    expect(storyTurns).toBeLessThan(previewScenario.maxCandidateTurns);

    for (let turn = 1; turn <= storyTurns; turn += 1) {
      simulation.send(`Turn ${turn}`);
      vi.advanceTimersByTime(100);
    }

    const state = simulation.getSnapshot();
    expect(state.stage).toBe('finished');
    expect(state.ending).toBe('completed');
    expect(state.candidateTurns).toBe(storyTurns);
    expect(state.turns.at(-1)?.text).toBe(previewLines.at(-1));
    expect(new Set(state.turns.filter((t) => t.speaker === 'character').map((t) => t.text)).size).toBe(
      previewLines.length,
    );
    expect(simulation.send('One more')).toBe(false);
  });

  it('closes at the cap when the story is longer than the cap', () => {
    const simulation = new PreviewSimulation({ ...previewScenario, maxCandidateTurns: 2 }, previewLines, 100);

    for (let turn = 1; turn <= 2; turn += 1) {
      simulation.send(`Turn ${turn}`);
      vi.advanceTimersByTime(100);
    }

    const state = simulation.getSnapshot();
    expect(state).toMatchObject({ stage: 'finished', ending: 'completed', candidateTurns: 2 });
    expect(state.turns.at(-1)?.text).toBe(previewLines.at(-1));
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
