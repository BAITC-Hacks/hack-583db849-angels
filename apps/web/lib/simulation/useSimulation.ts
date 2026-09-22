'use client';

import { useSyncExternalStore } from 'react';
import { getSimulation, getWorld, subscribeWorld } from '../demo/world';
import { previewCandidateLines, previewScenario } from './previewScenario';
import type { ScenarioBrief, SimulationState } from './types';

export interface Simulation {
  scenario: ScenarioBrief;
  state: SimulationState;
  /** True while the screen runs on scripted lines rather than the simulator. */
  preview: boolean;
  /** Speaking, unless staff switched typing on for this candidate. */
  inputMode: 'voice' | 'text';
  /** A spoken turn: the recording goes up, the transcript comes back as the turn. */
  sendVoice: (clip: Blob) => boolean;
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

  const accommodation = useSyncExternalStore(subscribeWorld, () => getWorld().accommodations.A, () => ({ textMode: false, reason: '' }));

  return {
    scenario: previewScenario,
    state,
    preview: true,
    inputMode: accommodation.textMode ? 'text' : 'voice',
    // Nothing is transcribed on the preview: the recording is made and kept in
    // the browser, and the scripted line the rest of the demo is written
    // against stands in for what the recogniser would have heard.
    sendVoice: (clip) => {
      if (clip.size === 0) return false;
      const heard = previewCandidateLines[Math.min(state.candidateTurns, previewCandidateLines.length - 1)];
      return driver.send(heard);
    },
    send: (text) => driver.send(text),
    stop: () => driver.stop(),
  };
}
