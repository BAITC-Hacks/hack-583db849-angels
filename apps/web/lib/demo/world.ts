'use client';

import { useSyncExternalStore } from 'react';
import { previewLines, previewScenario } from '../simulation/previewScenario';
import { PreviewSimulation } from '../simulation/previewDriver';

/**
 * The demo's shared state, held in this browser tab for as long as it is open.
 *
 * Every screen writes what happened — the candidate finished the simulation,
 * the interviewer saved their scores — and every role's home reads it, so
 * switching roles shows the same story moving forward. It is never written to
 * browser storage: a reload starts the demo again, like the stand's mocks. The
 * API replaces it slice by slice.
 */
export type CandidateCode = 'A' | 'B' | 'C';
export type SimulationStatus = 'not-started' | 'in-progress' | 'completed';
export type TranscriptStatus = 'none' | 'transcribing' | 'ready';

export interface CandidateProgress {
  code: CandidateCode;
  id: string;
  /** Only candidate A has preview data today; B and C arrive with the seed. */
  hasData: boolean;
  briefViewed: boolean;
  simulation: SimulationStatus;
  assessmentReady: boolean;
  transcript: TranscriptStatus;
  scoresSaved: boolean;
  draftReady: boolean;
}

export type DemoEventCode =
  | 'brief-viewed'
  | 'simulation-started'
  | 'simulation-completed'
  | 'simulation-stopped'
  | 'assessment-ready'
  | 'recording-loaded'
  | 'transcript-ready'
  | 'scores-saved'
  | 'draft-ready'
  | 'demo-reset';

export interface DemoEvent {
  id: number;
  at: string;
  code: DemoEventCode;
  candidate: CandidateCode | null;
}

export interface World {
  candidates: Record<CandidateCode, CandidateProgress>;
  events: DemoEvent[];
}

const ids: Record<CandidateCode, string> = {
  A: '00000000-0000-4000-8000-00000000000a',
  B: '00000000-0000-4000-8000-00000000000b',
  C: '00000000-0000-4000-8000-00000000000c',
};

function fresh(code: CandidateCode): CandidateProgress {
  return {
    code,
    id: ids[code],
    hasData: code === 'A',
    briefViewed: false,
    simulation: 'not-started',
    assessmentReady: false,
    transcript: 'none',
    scoresSaved: false,
    draftReady: false,
  };
}

function initial(): World {
  return { candidates: { A: fresh('A'), B: fresh('B'), C: fresh('C') }, events: [] };
}

let world: World = initial();
let nextEvent = 1;
const listeners = new Set<() => void>();
const resetListeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getWorld(): World {
  return world;
}

export function subscribeWorld(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverWorld = initial();

export function useWorld(): World {
  return useSyncExternalStore(subscribeWorld, getWorld, () => serverWorld);
}

/** Records a step for a candidate. Repeating a step that already happened changes nothing. */
export function record(code: DemoEventCode, candidate: CandidateCode | null, patch?: Partial<CandidateProgress>): void {
  if (candidate && patch) {
    const current = world.candidates[candidate];
    const changed = Object.entries(patch).some(([key, value]) => current[key as keyof CandidateProgress] !== value);
    if (!changed) return;
    world = { ...world, candidates: { ...world.candidates, [candidate]: { ...current, ...patch } } };
  }
  world = { ...world, events: [{ id: nextEvent++, at: new Date().toISOString(), code, candidate }, ...world.events].slice(0, 50) };
  emit();
}

/** Screens that keep their own session state (the simulation, the interview) drop it on reset. */
export function onReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function resetWorld(): void {
  world = initial();
  simulation = null;
  resetListeners.forEach((listener) => listener());
  record('demo-reset', null);
}

// ---- The candidate's simulation lives here, so leaving the page does not lose it.

let simulation: PreviewSimulation | null = null;

export function getSimulation(): PreviewSimulation {
  if (!simulation) {
    const driver = new PreviewSimulation(previewScenario, previewLines);
    driver.subscribe(() => {
      const state = driver.getSnapshot();
      if (state.candidateTurns === 1 && state.stage !== 'finished') {
        record('simulation-started', 'A', { simulation: 'in-progress' });
      }
      if (state.stage === 'finished') {
        record(state.ending === 'stopped' ? 'simulation-stopped' : 'simulation-completed', 'A', { simulation: 'completed' });
        record('assessment-ready', 'A', { assessmentReady: true });
      }
    });
    simulation = driver;
  }
  return simulation;
}

/** For the presenter: skip playing the simulation and use candidate A's recorded session. */
export function completeWithRecordedSession(candidate: CandidateCode): void {
  record('simulation-completed', candidate, { simulation: 'completed' });
  record('assessment-ready', candidate, { assessmentReady: true });
}

export const homeFor: Record<'interviewer' | 'commission' | 'admin' | 'candidate', string> = {
  interviewer: '/interviewer',
  commission: '/commission',
  admin: '/admin',
  candidate: '/candidate',
};
