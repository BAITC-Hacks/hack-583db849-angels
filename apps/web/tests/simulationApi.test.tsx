import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CandidateHome from '../app/(product)/candidate/page';
import type { WireCandidate, WireSimulation, WireTurnResult } from '../lib/api/contract';
import { applyTurnResult } from '../lib/api/mappers/simulation';
import { resetWorld } from '../lib/demo/world';
import { useSimulation } from '../lib/simulation/useSimulation';
import { apiError, example, hookWithQuery, json, mockApi, withQuery } from './apiHarness';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => '/' }));

const created = example<WireSimulation>('simulation-created.json');
const turn = example<WireTurnResult>('simulation-turn.json');
const candidates = example<{ items: WireCandidate[] }>('candidates.json');
const id = created.simulationId;
const turnsPath = `/api/v1/simulations/${id}/turns`;

const played: string[] = [];
class FakeAudio {
  constructor(readonly src: string) {}
  play() {
    played.push(this.src);
    return Promise.resolve();
  }
}

beforeEach(() => {
  resetWorld();
  played.length = 0;
  push.mockReset();
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => vi.unstubAllGlobals());

function simulationRoutes(turnAnswers: Array<() => Response>) {
  return mockApi({
    [`GET /api/v1/simulations/${id}`]: () => json(created),
    'GET /api/v1/candidates': () => json(candidates),
    [`POST ${turnsPath}`]: () => (turnAnswers.shift() ?? (() => apiError(500, 'INTERNAL_ERROR')))(),
    [`POST /api/v1/simulations/${id}/complete`]: () =>
      json({ ...created, status: 'completed', stage: 'finished', ending: 'stopped', completedAt: '2026-09-25T10:10:00Z' }),
  });
}

describe('a turn result applied to the cached simulation', () => {
  it('appends what was heard and the reply, and follows the stage', () => {
    const next = applyTurnResult(created, turn);
    expect(next.turns.map((item) => item.turnId)).toEqual(['turn_01', 'turn_02', 'turn_03']);
    expect(next.stage).toBe(turn.stage);
    expect(next.ending).toBeNull();
    const done = applyTurnResult(next, { ...turn, status: 'completed', stage: 'finished' }, new Date('2026-09-25T10:11:00Z'));
    expect(done).toMatchObject({ status: 'completed', ending: 'completed', completedAt: '2026-09-25T10:11:00.000Z' });
  });
});

describe('the simulation on the API', () => {
  it('opens the simulation by its id, spoken unless staff switched typing on', async () => {
    simulationRoutes([]);
    const { result } = hookWithQuery(() => useSimulation(id));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.scenario?.title).toBe(created.scenario.title);
    expect(result.current.inputMode).toBe('voice');
    expect(result.current.state.turns).toHaveLength(1);
  });

  it('sends a spoken turn as audio, shows what was heard and plays the reply', async () => {
    const calls = simulationRoutes([() => json(turn)]);
    const { result } = hookWithQuery(() => useSimulation(id));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => {
      expect(result.current.sendVoice(new Blob(['words'], { type: 'audio/webm' }))).toBe(true);
    });
    await waitFor(() => expect(result.current.state.turns).toHaveLength(3));

    const sent = calls.find((call) => call.method === 'POST' && call.path === turnsPath)!;
    expect(sent.body).toBeInstanceOf(FormData);
    expect((sent.body as FormData).get('audio')).toBeInstanceOf(Blob);
    expect(sent.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.current.state.turns[1].text).toBe(turn.candidateTurn!.text);
    expect(played).toEqual([`/api${turn.characterAudioUrl}`]);
  });

  it('asks to record again when nothing was recognised, and keeps the transcript as it was', async () => {
    simulationRoutes([() => apiError(422, 'SPEECH_NOT_RECOGNISED')]);
    const { result } = hookWithQuery(() => useSimulation(id));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => void result.current.sendVoice(new Blob(['mumble'], { type: 'audio/webm' })));
    await waitFor(() => expect(result.current.turnError).toBe("We didn't catch that — please record again."));
    expect(result.current.canRetry).toBe(false);
    expect(result.current.state.turns).toHaveLength(1);
  });

  it('offers to try again after a server failure, under the same key', async () => {
    const calls = simulationRoutes([() => apiError(503, 'AI_UNAVAILABLE'), () => json(turn)]);
    const { result } = hookWithQuery(() => useSimulation(id));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => void result.current.sendVoice(new Blob(['words'], { type: 'audio/webm' })));
    await waitFor(() => expect(result.current.canRetry).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.turns).toHaveLength(3));

    const keys = calls.filter((call) => call.path === turnsPath).map((call) => call.headers.get('idempotency-key'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('lets the candidate stop, and then takes no more turns', async () => {
    simulationRoutes([() => json(turn)]);
    const { result } = hookWithQuery(() => useSimulation(id));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state.ending).toBe('stopped'));
    let accepted = true;
    act(() => {
      accepted = result.current.sendVoice(new Blob(['late'], { type: 'audio/webm' }));
    });
    expect(accepted).toBe(false);
  });
});

describe('the candidate home on the API', () => {
  const notStarted = {
    items: candidates.items.map((item) => ({ ...item, progress: { ...item.progress!, simulation: null, assessment: null } })),
  };

  it('starts the simulation and opens it', async () => {
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(notStarted),
      'POST /api/v1/simulations': () => json(created, 201),
    });
    withQuery(<CandidateHome />);
    fireEvent.click(await screen.findByRole('button', { name: /Start the simulation/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/simulation/${id}`));
    const sent = calls.find((call) => call.method === 'POST')!;
    expect(JSON.parse(sent.body as string)).toEqual({ candidateId: created.candidateId });
    expect(sent.headers.get('idempotency-key')).toBeTruthy();
  });

  it('opens the existing simulation when one was already started', async () => {
    mockApi({
      'GET /api/v1/candidates': () => json(notStarted),
      'POST /api/v1/simulations': () => apiError(409, 'SIMULATION_EXISTS', { simulationId: 'already-there' }),
    });
    withQuery(<CandidateHome />);
    fireEvent.click(await screen.findByRole('button', { name: /Start the simulation/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/simulation/already-there'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('links the feedback once it is ready, and never shows a score', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(candidates) });
    const { container } = withQuery(<CandidateHome />);
    const link = await screen.findByRole('link', { name: /Read your feedback/ });
    expect(link.getAttribute('href')).toBe(`/feedback/${candidates.items[0].progress!.assessment!.assessmentId}`);
    expect(container.textContent).not.toMatch(/\d\s*\/\s*4|score:/i);
  });
});
