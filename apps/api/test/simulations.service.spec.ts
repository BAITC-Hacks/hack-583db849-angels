import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';

import { SimulationsService } from '../src/modules/simulations/simulations.service';
import { AudioStorageService } from '../src/modules/simulations/audio-storage.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';
import { IdempotencyService } from '../src/idempotency/idempotency.service';

const candidateId = '00000000-0000-4000-8000-00000000000a';
const scenario = (scenarioId: string, status: 'draft' | 'ready' = 'ready') => ({
  scenarioId, title: scenarioId, status, situation: 'A synthetic conflict', yourRole: 'Leader', goal: 'Listen',
  character: { name: 'Dana', role: 'Teammate', wants: 'A review' }, expectedMinutes: 8, maxCandidateTurns: 8,
});
const opening = { text: 'What should we do?', stage: 'opening' as const, ended: false,
  director: { beat: 'opening', matchedAnswerType: 'start', similarity: null, nextBeat: 'trust', reason: 'Start' } };
const answer = { text: 'I hear you.', stage: 'in-progress' as const, ended: false,
  director: { beat: 'trust', matchedAnswerType: 'listen', similarity: 0.9, nextBeat: 'decision', reason: 'Listened' } };

function harness(options: { scenarios?: ReturnType<typeof scenario>[]; counts?: Record<string, number>; textMode?: boolean; audio?: AudioStorageService; demo?: boolean; externalId?: string } = {}) {
  let simulation: Record<string, unknown> | null = null;
  const turns: Record<string, unknown>[] = [];
  const idempotencyRows = new Map<string, Record<string, unknown>>();
  const audio = options.audio ?? ({
    saveCharacter: jest.fn().mockResolvedValue('character/example.mp3'),
    saveCandidate: jest.fn().mockResolvedValue('turns/example.webm'),
    durationSeconds: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(Buffer.from('mp3')),
  } as unknown as AudioStorageService);
  const gateway = {
    scenarios: jest.fn().mockResolvedValue(options.scenarios ?? [scenario('ready-one')]),
    simulationTurn: jest.fn().mockImplementation((request: { turns: unknown[] }) => Promise.resolve(request.turns.length ? answer : opening)),
    transcribeTurn: jest.fn().mockResolvedValue({ turns: [
      { speaker: 'candidate', text: 'I understand', startSec: 0, endSec: 1, confidence: 0.92 },
      { speaker: 'candidate', text: 'Ada Example', startSec: 1, endSec: 2, confidence: 0.73 },
    ], durationSec: 2 }),
    speech: jest.fn().mockResolvedValue(Buffer.from('mp3')),
  };
  const prisma: Record<string, unknown> = {
    candidate: { findUnique: jest.fn().mockResolvedValue({ id: candidateId, externalId: options.externalId ?? 'inv-2026-demo-a', profile: { fullName: 'Ada Example' } }) },
    accommodation: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(options.textMode ? { textMode: true } : null)),
      upsert: jest.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) => Promise.resolve({ ...create, updatedAt: new Date() })),
    },
    simulation: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id?: string; candidateId?: string } }) =>
        Promise.resolve(simulation && (where.id === simulation.id || where.candidateId === simulation.candidateId)
          ? { ...simulation, turns: [...turns] } : null)),
      groupBy: jest.fn().mockResolvedValue(Object.entries(options.counts ?? {}).map(([scenarioId, count]) =>
        ({ scenarioId, _count: { _all: count } }))),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> & { id: string; turns: { create: Record<string, unknown> } } }) => {
        simulation = { ...data, createdAt: new Date(), completedAt: data.completedAt ?? null, turnInFlight: false,
          scenario: data.scenario };
        turns.push({ ...data.turns.create, id: 'opening-id', createdAt: new Date(), simulationId: data.id });
        return Promise.resolve({ ...simulation, turns: [...turns] });
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!simulation || (where.status && simulation.status !== where.status) ||
            (where.turnInFlight !== undefined && simulation.turnInFlight !== where.turnInFlight)) return Promise.resolve({ count: 0 });
        Object.assign(simulation, data);
        return Promise.resolve({ count: 1 });
      }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(simulation!, data);
        return Promise.resolve({ ...simulation });
      }),
    },
    simulationTurn: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `stored-${data.sequence}`, createdAt: new Date(),
          startedAt: data.startedAt ?? null, endedAt: data.endedAt ?? null, director: data.director ?? null };
        turns.push(row);
        return Promise.resolve(row);
      }),
      delete: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        const index = turns.findIndex((turn) => turn.id === where.id);
        if (index >= 0) turns.splice(index, 1);
        return Promise.resolve({});
      }),
    },
    idempotencyKey: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { key: string } }) => Promise.resolve(idempotencyRows.get(where.key))),
      create: jest.fn().mockImplementation(({ data }: { data: { key: string } }) => {
        idempotencyRows.set(data.key, data);
        return Promise.resolve(data);
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation((operation: unknown) => typeof operation === 'function'
      ? (operation as (client: unknown) => Promise<unknown>)(prisma) : Promise.all(operation as Promise<unknown>[])),
  };
  const audit = { record: jest.fn().mockResolvedValue({}) };
  const assessments = { startAutomatically: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (key: string) => (key === 'DEMO_MODE' ? String(options.demo ?? false) : undefined) };
  const service = new SimulationsService(prisma as never, gateway as never, audio, new ToLlmViewService(), audit as never, assessments as never, config as never);
  return { service, prisma, gateway, audio, audit, assessments, turns };
}

describe('SimulationsService', () => {
  it('assigns only a ready scenario with the fewest prior assignments', async () => {
    const fixture = harness({ scenarios: [scenario('draft', 'draft'), scenario('busy'), scenario('least')],
      counts: { busy: 3, least: 1 } });
    const created = await fixture.service.create(candidateId, 'platform');
    expect(created.scenario.scenarioId).toBe('least');
    expect(created.scenario).not.toHaveProperty('status');
    expect(created.turns.map((turn) => turn.turnId)).toEqual(['turn_01']);
    expect(fixture.assessments.startAutomatically).not.toHaveBeenCalled();
    expect(fixture.gateway.simulationTurn).toHaveBeenCalledWith({ scenarioId: 'least', turns: [] });
    expect(fixture.gateway.speech).toHaveBeenCalledWith(opening.text, 'least');
    await expect(fixture.service.create(candidateId, 'platform')).rejects.toMatchObject({
      status: 409, response: { code: 'SIMULATION_EXISTS', details: { simulationId: created.simulationId } },
    });
  });

  it('in DEMO_MODE gives A, B and C the scenario of their recorded session, and everyone else the pool', async () => {
    const pool = [scenario('resource-crisis'), scenario('conflict-resolution'), scenario('ethical-dilemma')];
    const seeded = harness({ scenarios: pool, counts: { 'conflict-resolution': 5 }, demo: true });
    await expect(seeded.service.create(candidateId, 'platform')).resolves.toMatchObject({ scenario: { scenarioId: 'conflict-resolution' } });

    const outside = harness({ scenarios: pool, counts: { 'conflict-resolution': 5, 'ethical-dilemma': 5 }, demo: false });
    await expect(outside.service.create(candidateId, 'platform')).resolves.toMatchObject({ scenario: { scenarioId: 'resource-crisis' } });

    const stranger = harness({ scenarios: pool, counts: { 'conflict-resolution': 5, 'ethical-dilemma': 5 }, demo: true, externalId: 'inv-2026-0042' });
    await expect(stranger.service.create(candidateId, 'platform')).resolves.toMatchObject({ scenario: { scenarioId: 'resource-crisis' } });
  });

  it('breaks equal-count ties randomly and refuses an empty ready pool', async () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const fixture = harness({ scenarios: [scenario('one'), scenario('two')] });
      expect((await fixture.service.create(candidateId, 'platform')).scenario.scenarioId).toBe('two');
    } finally { random.mockRestore(); }
    const empty = harness({ scenarios: [scenario('draft', 'draft')] });
    await expect(empty.service.create(candidateId, 'platform')).rejects.toMatchObject({
      status: 503, response: { code: 'NO_SCENARIO_READY' },
    });
  });

  it('spreads 100 candidates over the ready scenarios so the counts differ by at most one', async () => {
    const pool = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'].map((id) => scenario(id));
    const counts: Record<string, number> = {};
    for (let created = 0; created < 100; created += 1) {
      // Each create reads the pool from ML and the counts from the database, as they stand after the ones before.
      const fixture = harness({ scenarios: [...pool, scenario('draft', 'draft')], counts: { ...counts } });
      const { scenario: chosen } = await fixture.service.create(candidateId, 'platform');
      counts[chosen.scenarioId] = (counts[chosen.scenarioId] ?? 0) + 1;
    }
    const assigned = pool.map((item) => counts[item.scenarioId] ?? 0);
    expect(assigned.reduce((sum, count) => sum + count, 0)).toBe(100);
    expect(Math.max(...assigned) - Math.min(...assigned)).toBeLessThanOrEqual(1);
    expect(counts).not.toHaveProperty('draft');
  });

  it('assigns a scenario that has just become ready, with no restart', async () => {
    const fixture = harness({ scenarios: [scenario('s1'), scenario('s2'), scenario('newly-ready')], counts: { s1: 5, s2: 5 } });
    expect((await fixture.service.create(candidateId, 'platform')).scenario.scenarioId).toBe('newly-ready');
    expect(fixture.gateway.scenarios).toHaveBeenCalledTimes(1);
  });

  it('forbids text without an accommodation and sends every candidate turn with state and no profile', async () => {
    const voice = harness();
    const voiceId = (await voice.service.create(candidateId, 'platform')).simulationId;
    await expect(voice.service.turn(voiceId, { text: 'Hello' }, 'platform')).rejects.toMatchObject({
      status: 403, response: { code: 'TEXT_MODE_NOT_ALLOWED' },
    });

    const text = harness({ textMode: true });
    const textId = (await text.service.create(candidateId, 'platform')).simulationId;
    const response = await text.service.turn(textId, { text: 'Ada Example will listen' }, 'platform');
    expect(response.candidateTurn.turnId).toBe('turn_02');
    expect(response.characterTurn.turnId).toBe('turn_03');
    expect(response.recognitionConfidence).toBeNull();
    expect(response.characterAudioUrl).toBe(`/v1/simulations/${textId}/turns/turn_03/audio`);
    const sent = text.gateway.simulationTurn.mock.calls[1][0] as Record<string, unknown>;
    expect(sent).toMatchObject({ state: { beat: 'trust', candidateTurns: 1 } });
    expect(JSON.stringify(sent)).not.toContain('Ada Example');
    expect(JSON.stringify(sent)).not.toContain('profile');
    expect((await text.service.get(textId)).turns.map((turn) => turn.turnId)).toEqual(['turn_01', 'turn_02', 'turn_03']);
  });

  it('rejects a parallel turn and uses an idempotency key to avoid a duplicate turn', async () => {
    const fixture = harness({ textMode: true });
    const id = (await fixture.service.create(candidateId, 'platform')).simulationId;
    let release!: (value: typeof answer) => void;
    let entered!: () => void;
    const reachedGateway = new Promise<void>((resolve) => { entered = resolve; });
    fixture.gateway.simulationTurn.mockImplementation((request: { turns: unknown[] }) =>
      request.turns.length ? new Promise<typeof answer>((resolve) => { release = resolve; entered(); }) : Promise.resolve(opening));
    const first = fixture.service.turn(id, { text: 'Listen' }, 'platform');
    await reachedGateway;
    await expect(fixture.service.turn(id, { text: 'Race' }, 'platform')).rejects.toMatchObject({
      status: 409, response: { code: 'TURN_IN_FLIGHT' },
    });
    release(answer);
    await first;

    const idempotency = new IdempotencyService(fixture.prisma as never);
    const body = fixture.service.idempotencyBody(id, { text: 'Next' });
    fixture.gateway.simulationTurn.mockImplementation((request: { turns: unknown[] }) =>
      Promise.resolve(request.turns.length ? answer : opening));
    const once = await idempotency.execute('turn-key', body, () => fixture.service.turn(id, { text: 'Next' }, 'platform'), 200);
    const twice = await idempotency.execute('turn-key', body, () => fixture.service.turn(id, { text: 'Next' }, 'platform'), 200);
    expect(twice).toEqual(once);
    expect(fixture.turns.filter((turn) => turn.speaker === 'candidate')).toHaveLength(2);
  });

  it('deletes candidate audio after transcription and keeps the lowest confidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'invision-turn-'));
    try {
      const audio = new AudioStorageService({ get: () => root } as unknown as ConfigService);
      jest.spyOn(audio, 'durationSeconds').mockResolvedValue(2);
      const fixture = harness({ audio });
      const id = (await fixture.service.create(candidateId, 'platform')).simulationId;
      const result = await fixture.service.turn(id, {
        audio: { buffer: Buffer.from('synthetic webm'), mimetype: 'audio/webm', size: 14 },
      }, 'platform');
      expect(result.recognitionConfidence).toBe(0.73);
      expect(await readdir(join(root, 'turns', id))).toEqual([]);
      expect(fixture.gateway.transcribeTurn).toHaveBeenCalledWith(expect.stringMatching(/^turns\//));
      expect(JSON.stringify(fixture.gateway.simulationTurn.mock.calls[1][0])).not.toContain('Ada Example');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('keeps the director beat and complete transcript through three spoken turns', async () => {
    const fixture = harness();
    const id = (await fixture.service.create(candidateId, 'platform')).simulationId;
    for (let index = 0; index < 3; index += 1) {
      const result = await fixture.service.turn(id, {
        audio: { buffer: Buffer.from(`synthetic webm ${index}`), mimetype: 'audio/webm', size: 16 },
      }, 'platform');
      expect(result.candidateTurn.turnId).toBe(`turn_0${index * 2 + 2}`);
      expect(result.characterTurn.turnId).toBe(`turn_0${index * 2 + 3}`);
    }
    const candidateCalls = fixture.gateway.simulationTurn.mock.calls.slice(1).map(([request]) => request as {
      turns: { turnId: string }[]; state: { beat: string; candidateTurns: number };
    });
    expect(candidateCalls.map(({ state }) => state)).toEqual([
      { beat: 'trust', candidateTurns: 1 },
      { beat: 'decision', candidateTurns: 2 },
      { beat: 'decision', candidateTurns: 3 },
    ]);
    expect(candidateCalls.map(({ turns }) => turns.length)).toEqual([2, 4, 6]);
    expect((await fixture.service.get(id)).turns.map((turn) => turn.turnId)).toEqual([
      'turn_01', 'turn_02', 'turn_03', 'turn_04', 'turn_05', 'turn_06', 'turn_07',
    ]);
    expect(fixture.audio.delete).toHaveBeenCalledTimes(3);
  });

  it('does not save unrecognised speech and removes its temporary audio', async () => {
    const fixture = harness();
    const id = (await fixture.service.create(candidateId, 'platform')).simulationId;
    fixture.gateway.transcribeTurn.mockResolvedValueOnce({ turns: [], durationSec: 1 });
    await expect(fixture.service.turn(id, {
      audio: { buffer: Buffer.from('synthetic webm'), mimetype: 'audio/webm', size: 14 },
    }, 'platform')).rejects.toMatchObject({ status: 422, response: { code: 'SPEECH_NOT_RECOGNISED' } });
    expect(fixture.turns).toHaveLength(1);
    expect(fixture.audio.delete).toHaveBeenCalledWith('turns/example.webm');
  });

  it('rejects audio longer than 60 seconds before asking ML to transcribe it', async () => {
    const fixture = harness();
    const id = (await fixture.service.create(candidateId, 'platform')).simulationId;
    jest.spyOn(fixture.audio, 'durationSeconds').mockResolvedValueOnce(60.1);
    await expect(fixture.service.turn(id, {
      audio: { buffer: Buffer.from('synthetic webm'), mimetype: 'audio/webm', size: 14 },
    }, 'platform')).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_ERROR' } });
    expect(fixture.gateway.transcribeTurn).not.toHaveBeenCalled();
    expect(fixture.audio.delete).toHaveBeenCalledWith('turns/example.webm');
    expect(fixture.turns).toHaveLength(1);
  });

  it('passes an ML budget error through and leaves the simulation ready for a retry', async () => {
    const fixture = harness({ textMode: true });
    const id = (await fixture.service.create(candidateId, 'platform')).simulationId;
    fixture.gateway.simulationTurn.mockRejectedValueOnce(
      new HttpException({ code: 'AI_BUDGET_EXCEEDED', message: 'Budget exceeded' }, 503),
    );
    await expect(fixture.service.turn(id, { text: 'Please listen' }, 'platform')).rejects.toMatchObject({
      status: 503, response: { code: 'AI_BUDGET_EXCEEDED' },
    });
    expect(fixture.turns).toHaveLength(1);
    const retry = await fixture.service.turn(id, { text: 'Please listen' }, 'platform');
    expect(retry.candidateTurn.turnId).toBe('turn_02');
  });

  it('completes automatically when ML ends the conversation', async () => {
    const fixture = harness({ textMode: true });
    const id = (await fixture.service.create(candidateId, 'platform')).simulationId;
    fixture.gateway.simulationTurn.mockResolvedValueOnce({ ...answer, stage: 'finished', ended: true });
    const result = await fixture.service.turn(id, { text: 'We agree' }, 'platform');
    expect(result.status).toBe('completed');
    expect(fixture.assessments.startAutomatically).toHaveBeenCalledTimes(1);
    expect(fixture.assessments.startAutomatically).toHaveBeenCalledWith(id);
    expect(await fixture.service.get(id)).toMatchObject({ status: 'completed', ending: 'completed' });
    expect(fixture.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'simulation.completed', metadata: { ending: 'completed' },
    }));
  });

  it('stops a simulation and rejects later turns or accommodation changes', async () => {
    const fixture = harness();
    const id = (await fixture.service.create(candidateId, 'platform')).simulationId;
    const stopped = await fixture.service.complete(id, 'stopped', 'platform');
    expect(fixture.assessments.startAutomatically).toHaveBeenCalledTimes(1);
    await expect(fixture.service.complete(id, 'stopped', 'platform')).rejects.toMatchObject({ status: 409 });
    expect(fixture.assessments.startAutomatically).toHaveBeenCalledTimes(1);
    expect(stopped).toMatchObject({ status: 'completed', stage: 'finished', ending: 'stopped' });
    await expect(fixture.service.turn(id, { text: 'Later' }, 'platform')).rejects.toMatchObject({
      status: 409, response: { code: 'SIMULATION_FINISHED' },
    });
    await expect(fixture.service.accommodation(candidateId, { textMode: true, reason: 'Synthetic need' }, 'commission'))
      .rejects.toMatchObject({ status: 409, response: { code: 'SIMULATION_STARTED' } });
  });
});
