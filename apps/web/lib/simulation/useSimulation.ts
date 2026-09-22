'use client';

import { useSyncExternalStore } from 'react';
import { getSimulation, subscribeWorld } from '../demo/world';
import { previewScenario } from './previewScenario';
import type { ScenarioBrief, SimulationState } from './types';

export interface Simulation {
  scenario: ScenarioBrief;
  state: SimulationState;
  /** True while the screen runs on scripted lines rather than the simulator. */
  preview: boolean;
  send: (text: string) => boolean;
  stop: () => void;
}

/**
 * The screen's only door to a simulation. Today it plays the demo's scripted
 * session, which lives in the demo world so leaving the page does not lose it;
 * when the simulations API lands (#6), this hook calls the generated client
 * instead and the components stay as they are.
 */
export function useSimulation(sessionId: string): Simulation {
  const driver = useSyncExternalStore(subscribeWorld, getSimulation, getSimulation);
  const state = useSyncExternalStore(driver.subscribe, driver.getSnapshot, driver.getSnapshot);
  // The session id will select the simulation on the server; the preview has only one.
  void sessionId;

  return {
    scenario: previewScenario,
    state,
    preview: true,
    send: (text) => driver.send(text),
    stop: () => driver.stop(),
  };
}
