'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { previewLines, previewScenario } from './previewScenario';
import { PreviewSimulation } from './previewDriver';
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
 * The screen's only door to a simulation. Today it plays the scripted preview;
 * when the simulations API lands (#6), this hook calls the generated client
 * instead and the components stay as they are.
 */
export function useSimulation(sessionId: string): Simulation {
  const [driver] = useState(() => new PreviewSimulation(previewScenario, previewLines));
  const state = useSyncExternalStore(driver.subscribe, driver.getSnapshot, driver.getSnapshot);

  useEffect(() => () => driver.dispose(), [driver]);

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
