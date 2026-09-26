'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { candidatesKey } from '../api/candidates';
import { api, unwrap } from '../api/client';
import type { WireSimulation, WireTurnResult } from '../api/contract';
import { errorText, isRetryable, readApiError } from '../api/errors';
import { applyTurnResult, toScenarioBrief, toSimulationState } from '../api/mappers/simulation';
import { playCharacterLine, turnAudioUrl } from './characterVoice';
import type { ScenarioBrief, SimulationState } from './types';

export type TurnInput = { kind: 'voice'; clip: Blob } | { kind: 'text'; text: string };

export interface Simulation {
  scenario: ScenarioBrief | null;
  state: SimulationState;
  status: 'loading' | 'ready' | 'error';
  /** Why the simulation could not be opened, in words. */
  loadError: string | null;
  /** Speaking, unless staff switched typing on for this candidate before it started. */
  inputMode: 'voice' | 'text';
  /** Why the last turn did not go through, in words; the candidate can record again. */
  turnError: string | null;
  /** The last turn failed on the server's side: send it again, under the same key. */
  canRetry: boolean;
  sendVoice: (clip: Blob) => boolean;
  send: (text: string) => boolean;
  retry: () => void;
  stop: () => void;
  /** Plays a line of the character's again. */
  listen: (turnId: string) => void;
}

const empty: SimulationState = { stage: 'opening', turns: [], replying: false, candidateTurns: 0, ending: null };

export const simulationKey = (simulationId: string) => ['simulation', simulationId] as const;

async function postTurn(simulationId: string, input: TurnInput, idempotencyKey: string): Promise<WireTurnResult> {
  const url = `/api/v1/simulations/${encodeURIComponent(simulationId)}/turns`;
  const headers: Record<string, string> = { 'Idempotency-Key': idempotencyKey };
  let body: BodyInit;
  if (input.kind === 'voice') {
    const form = new FormData();
    const extension = input.clip.type.includes('ogg') ? 'ogg' : 'webm';
    form.append('audio', input.clip, `turn.${extension}`);
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ text: input.text });
  }
  const response = await fetch(url, { method: 'POST', headers, body });
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as WireTurnResult;
}

/**
 * The screen's only door to a simulation, on the API. The simulation lives on
 * the server under the key `['simulation', id]`, so a reload continues it.
 *
 * The milestones are also sent to the demo world's activity log, which the
 * admin reads until it moves to the audit log (#24).
 */
export function useSimulation(simulationId: string): Simulation {
  const client = useQueryClient();
  const key = simulationKey(simulationId);

  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      unwrap(await api.GET('/v1/simulations/{simulationId}', { params: { path: { simulationId } } })) as unknown as WireSimulation,
  });
  const simulation = query.data;

  const turn = useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: TurnInput; idempotencyKey: string }) =>
      postTurn(simulationId, input, idempotencyKey),
    onSuccess: (result) => {
      // The screen speaks the reply, word by word, once it is its turn (useSpokenLines).
      client.setQueryData<WireSimulation>(key, (current) => (current ? applyTurnResult(current, result) : current));
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });

  const stopping = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/simulations/{simulationId}/complete', {
          params: { path: { simulationId } },
          body: { reason: 'stopped' },
        }),
      ) as unknown as WireSimulation,
    onSuccess: (stopped) => {
      client.setQueryData(key, stopped);
      void client.invalidateQueries({ queryKey: candidatesKey });
    },
  });

  const state: SimulationState = simulation
    ? { ...toSimulationState(simulation), replying: turn.isPending }
    : { ...empty, replying: turn.isPending };
  const finished = state.stage === 'finished' || simulation?.status === 'completed';

  const submit = (input: TurnInput): boolean => {
    if (!simulation || finished || turn.isPending) return false;
    turn.mutate({ input, idempotencyKey: crypto.randomUUID() });
    return true;
  };

  return {
    scenario: simulation ? toScenarioBrief(simulation) : null,
    state,
    status: query.isPending ? 'loading' : query.isError ? 'error' : 'ready',
    loadError: query.isError ? errorText(query.error) : null,
    inputMode: simulation?.mode ?? 'voice',
    turnError: turn.isError ? errorText(turn.error) : stopping.isError ? errorText(stopping.error) : null,
    canRetry: turn.isError && isRetryable(turn.error) && turn.variables !== undefined,
    sendVoice: (clip) => (clip.size === 0 ? false : submit({ kind: 'voice', clip })),
    send: (text) => submit({ kind: 'text', text }),
    // The same input under the same key: if the first try did land, the server answers with that turn again.
    retry: () => {
      if (turn.variables && !turn.isPending) turn.mutate(turn.variables);
    },
    stop: () => {
      if (!finished && !stopping.isPending) stopping.mutate();
    },
    listen: (turnId) => {
      const line = simulation?.turns.find((item) => item.turnId === turnId);
      if (line) playCharacterLine(turnAudioUrl(simulationId, turnId), line.text);
    },
  };
}
