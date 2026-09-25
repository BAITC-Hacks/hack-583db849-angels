import { AdminService } from '../src/modules/admin/admin.service';
import { DemoService } from '../src/modules/demo/demo.service';
import { readSeed } from '../src/seed-files';

const candidateId = '00000000-0000-4000-8000-00000000000a';
const config = (demo: boolean) => ({ get: (name: string, fallback?: string) => (name === 'DEMO_MODE' ? String(demo) : name === 'UPLOADS_DIR' ? '/tmp/no-such-uploads' : fallback) });

describe('AdminService', () => {
  const prisma = {
    candidate: { count: jest.fn().mockResolvedValue(3) },
    simulation: { count: jest.fn().mockResolvedValue(1) },
    assessment: { count: jest.fn().mockResolvedValue(1) },
    interviewerScore: { count: jest.fn().mockResolvedValue(2) },
    auditEvent: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'e1', createdAt: new Date('2026-09-26T10:40:02Z'), actorRole: null, action: 'draft.created', candidateId, targetId: 'i1', candidate: { label: 'Candidate A' } },
        { id: 'e2', createdAt: new Date('2026-09-26T10:40:00Z'), actorRole: 'interviewer', action: 'scores.saved', candidateId, targetId: 'i1', candidate: { label: 'Candidate A' } },
      ]),
    },
  };

  it('shows the gateway’s usage when ML answers, and ML as down when it does not', async () => {
    const usage = { gatewayMode: 'replay', liveCalls: 0, replayedCalls: 14, spentUsd: 0, capUsd: 20 };
    const up = new AdminService(prisma as never, { usage: jest.fn().mockResolvedValue(usage) } as never, config(true) as never);
    await expect(up.overview()).resolves.toMatchObject({
      demoMode: true, gatewayMode: 'replay', ml: 'up', usage: { replayedCalls: 14, capUsd: 20 },
      counts: { candidates: 3, simulationsCompleted: 1, assessmentsReady: 1, interviewsScored: 2 },
    });
    const down = new AdminService(prisma as never, { usage: jest.fn().mockRejectedValue(new Error('down')) } as never, config(false) as never);
    await expect(down.overview()).resolves.toMatchObject({ demoMode: false, ml: 'down', usage: { liveCalls: 0 } });
  });

  it('serves only the actions the contract names, and calls what the API did by itself “system”', async () => {
    const service = new AdminService(prisma as never, {} as never, config(true) as never);
    const { items } = await service.auditEvents(50);
    expect(prisma.auditEvent.findMany.mock.calls[0][0].where.action.in).not.toContain('simulation.turn');
    expect(items[0]).toEqual({
      eventId: 'e1', at: '2026-09-26T10:40:02.000Z', actorRole: 'system', action: 'draft.created', candidateId, candidateLabel: 'Candidate A', subjectId: 'i1',
    });
    expect(items[1].actorRole).toBe('interviewer');
  });
});

describe('DemoService', () => {
  function harness({ demo = true, externalId = 'inv-2026-demo-a', existing = null as { id: string } | null } = {}) {
    const deleted: string[] = [];
    const table = (name: string) => ({ deleteMany: jest.fn(() => { deleted.push(name); return name; }) });
    const prisma = {
      $transaction: jest.fn((operations: unknown[]) => Promise.resolve(operations)),
      qualityCheck: table('qualityCheck'), consistencyReport: table('consistencyReport'), interviewDraft: table('interviewDraft'),
      interviewerScore: table('interviewerScore'), interview: table('interview'), surpriseQuestion: table('surpriseQuestion'),
      assessment: table('assessment'), simulationTurn: table('simulationTurn'), accommodation: table('accommodation'), presentation: table('presentation'),
      candidate: { findUnique: jest.fn().mockResolvedValue({ id: candidateId, externalId }) },
      simulation: { ...table('simulation'), findUnique: jest.fn().mockResolvedValue(existing), create: jest.fn().mockResolvedValue({ id: 'simulation-1' }) },
    };
    const gateway = { scenarios: jest.fn().mockResolvedValue([{ scenarioId: 'conflict-resolution', title: 'A teammate is about to walk away', status: 'ready' }]) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const candidates = { progress: jest.fn().mockResolvedValue({ candidateId, simulation: { status: 'completed' } }) };
    const seed = { seed: jest.fn().mockResolvedValue(undefined) };
    const assessments = { startAutomatically: jest.fn().mockResolvedValue(undefined) };
    const service = new DemoService(prisma as never, config(demo) as never, gateway as never, audit as never, candidates as never, seed as never, assessments as never);
    return { service, prisma, deleted, audit, seed, assessments };
  }

  it('answers 404 for both controls with DEMO_MODE off', async () => {
    const { service } = harness({ demo: false });
    await expect(service.reset('admin')).rejects.toMatchObject({ status: 404 });
    await expect(service.recordedSession(candidateId, 'admin')).rejects.toMatchObject({ status: 404 });
  });

  it('drops everything the demo made, keeps the audit log, and seeds A, B and C again', async () => {
    const { service, deleted, audit, seed } = harness();
    await service.reset('admin');
    expect(deleted).toEqual(expect.arrayContaining(['simulation', 'assessment', 'interview', 'surpriseQuestion', 'presentation', 'qualityCheck', 'consistencyReport']));
    expect(deleted).not.toContain('auditEvent');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'demo.reset', actorRole: 'admin' }));
    expect(seed.seed).toHaveBeenCalled();
  });

  it('completes a seed candidate’s simulation from the recorded transcript and starts its assessment', async () => {
    const { service, prisma, assessments } = harness();
    const progress = await service.recordedSession(candidateId, 'commission');
    const recorded = await readSeed<{ text: string }[]>('candidates', 'a', 'transcript.json');
    const data = prisma.simulation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ candidateId, scenarioId: 'conflict-resolution', status: 'completed', ending: 'completed' });
    expect(data.turns.create.map((turn: { text: string }) => turn.text)).toEqual(recorded.map((turn) => turn.text));
    expect(assessments.startAutomatically).toHaveBeenCalledWith('simulation-1');
    expect(progress).toMatchObject({ simulation: { status: 'completed' } });
  });

  it('refuses a second simulation and a candidate with no recording', async () => {
    await expect(harness({ existing: { id: 'simulation-0' } }).service.recordedSession(candidateId, 'admin'))
      .rejects.toMatchObject({ status: 409, response: { code: 'SIMULATION_EXISTS', details: { simulationId: 'simulation-0' } } });
    await expect(harness({ externalId: 'inv-2026-live-0001' }).service.recordedSession(candidateId, 'admin')).rejects.toMatchObject({ status: 404 });
  });
});
