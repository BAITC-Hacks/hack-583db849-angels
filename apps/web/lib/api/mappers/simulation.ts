import type { ScenarioBrief, SimulationState, SimulationTurn } from '../../simulation/types';
import type { WireSimulation, WireTurn, WireTurnResult } from '../contract';

function toTurn(turn: WireTurn): SimulationTurn {
  return { turnId: turn.turnId, speaker: turn.speaker, text: turn.text };
}

export function toScenarioBrief(simulation: WireSimulation): ScenarioBrief {
  const { title, situation, yourRole, goal, character, expectedMinutes, maxCandidateTurns } = simulation.scenario;
  return { title, situation, yourRole, goal, character, expectedMinutes, maxCandidateTurns };
}

/**
 * The simulation as the screen holds it. `replying` is false here: a turn is
 * only in flight while the screen is waiting for this very call to answer, so
 * it belongs to the mutation, not to what came back from the server.
 */
export function toSimulationState(simulation: WireSimulation): SimulationState {
  return {
    stage: simulation.stage,
    turns: simulation.turns.map(toTurn),
    replying: false,
    candidateTurns: simulation.turns.filter((turn) => turn.speaker === 'candidate').length,
    ending: simulation.ending,
  };
}

/**
 * One spoken turn came back: the candidate's transcribed words, then the
 * character's reply. The candidate's turn is absent only for the opening line.
 */
export function appendTurn(state: SimulationState, result: WireTurnResult): SimulationState {
  const added = [result.candidateTurn, result.characterTurn].filter((turn): turn is WireTurn => turn !== null);
  return {
    stage: result.stage,
    turns: [...state.turns, ...added.map(toTurn)],
    replying: false,
    candidateTurns: result.candidateTurns,
    ending: result.status === 'completed' ? (state.ending ?? 'completed') : null,
  };
}

/**
 * The same turn result, applied to the simulation the screen keeps in its
 * query cache, so the transcript grows without a second round trip. Once the
 * simulation ends here it has ended as `completed`: a stop comes back as a
 * whole simulation from `/complete`, not as a turn.
 */
export function applyTurnResult(simulation: WireSimulation, result: WireTurnResult, now = new Date()): WireSimulation {
  const added = [result.candidateTurn, result.characterTurn].filter((turn): turn is WireTurn => turn !== null);
  const completed = result.status === 'completed';
  return {
    ...simulation,
    stage: result.stage,
    status: result.status,
    ending: completed ? (simulation.ending ?? 'completed') : simulation.ending,
    completedAt: completed ? (simulation.completedAt ?? now.toISOString()) : simulation.completedAt,
    turns: [...simulation.turns, ...added],
  };
}
