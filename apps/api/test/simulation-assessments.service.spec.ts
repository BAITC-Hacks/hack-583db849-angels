import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { contractExample } from '../src/contract-example';
import { SimulationAssessmentsService } from '../src/modules/simulation-assessments/simulation-assessments.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

const simulationId = '6f1c2a0e-0000-4000-8000-00000000a002';
const candidateId = '00000000-0000-4000-8000-00000000000a';
const assessmentId = '6f1c2a0e-0000-4000-8000-00000000a003';

function harness(status: 'active' | 'completed' = 'completed') {
  const simulation = {
    id: simulationId,
    candidateId,
    scenarioId: 'conflict-resolution',
    scenario: { title: 'A teammate is about to walk away', character: { name: 'Dana' } },
    mode: 'voice' as const,
    status,
    accommodation: false,
    createdAt: new Date('2026-09-25T10:04:50Z'),
    completedAt: status === 'completed' ? new Date('2026-09-25T10:11:50Z') : null,
    candidate: { profile: { fullName: 'Ada Example' } },
    turns: [
      { sequence: 1, speaker: 'candidate' as const, text: 'Ada Example will listen',
        startedAt: new Date('2026-09-25T10:05:00Z'), endedAt: new Date('2026-09-25T10:05:20Z'),
        createdAt: new Date('2026-09-25T10:05:00Z') },
    ],
  };
  let row: Record<string, unknown> | null = null;
  const gateway = {
    simulationAssessment: jest.fn().mockResolvedValue(contractExample('ml/simulation-assessment.response.json')),
  };
  const prisma = {
    simulation: { findUnique: jest.fn().mockResolvedValue(simulation) },
    assessment: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        if (row) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.19.3' });
        row = { ...data, id: assessmentId, result: null, feedback: null, createdAt: new Date('2026-09-25T10:11:58Z') };
        return Promise.resolve({ id: assessmentId });
      }),
      findUnique: jest.fn().mockImplementation(({ include }: { include?: unknown }) => {
        if (!row) return Promise.resolve(null);
        return Promise.resolve(include ? { ...row, candidate: { label: 'Candidate A' }, simulation } : { id: assessmentId });
      }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        row = { ...row, ...data };
        return Promise.resolve({ ...row, id: assessmentId });
      }),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue({}) };
  const briefs = { startFor: jest.fn().mockResolvedValue(undefined) };
  const service = new SimulationAssessmentsService(prisma as never, gateway as never, new ToLlmViewService(), audit as never, briefs as never);
  return { service, gateway, prisma, audit, briefs, simulation, stored: () => row };
}

describe('SimulationAssessmentsService', () => {
  it('shows the recognition confidence on the report, and never sends it to ML', async () => {
    const fixture = harness();
    Object.assign(fixture.simulation.turns[0], { recognitionConfidence: 0.42 });
    await fixture.service.startAutomatically(simulationId);
    const sent = fixture.gateway.simulationAssessment.mock.calls[0][0] as { turns: Record<string, unknown>[] };
    expect(sent.turns[0]).not.toHaveProperty('recognitionConfidence');
    const report = await fixture.service.get(assessmentId);
    expect(report.simulation.turns[0].recognitionConfidence).toBe(0.42);
  });

  it('does not assess a simulation the candidate stopped before saying anything', async () => {
    const fixture = harness();
    fixture.simulation.turns = [
      { sequence: 1, speaker: 'character' as never, text: 'Honestly, I am done.',
        startedAt: new Date('2026-09-25T10:05:00Z'), endedAt: new Date('2026-09-25T10:05:05Z'),
        createdAt: new Date('2026-09-25T10:05:00Z') },
    ];
    await fixture.service.startAutomatically(simulationId);
    expect(fixture.gateway.simulationAssessment).not.toHaveBeenCalled();
    expect(fixture.prisma.assessment.create).not.toHaveBeenCalled();
    await expect(fixture.service.rerun(simulationId)).rejects.toMatchObject({
      status: 409, response: { code: 'NOTHING_TO_ASSESS' },
    });
  });

  it('does not assess before completion and rejects an early manual re-run', async () => {
    const fixture = harness('active');
    await fixture.service.startAutomatically(simulationId);
    expect(fixture.gateway.simulationAssessment).not.toHaveBeenCalled();
    expect(fixture.prisma.assessment.create).not.toHaveBeenCalled();
    await expect(fixture.service.rerun(simulationId)).rejects.toMatchObject({
      status: 409, response: { code: 'SIMULATION_NOT_FINISHED' },
    });
  });

  it('starts once, sends the full redacted transcript, stores separate result and feedback, and serves both views', async () => {
    const fixture = harness();
    await fixture.service.startAutomatically(simulationId);
    await fixture.service.startAutomatically(simulationId);
    expect(fixture.gateway.simulationAssessment).toHaveBeenCalledTimes(1);
    // The brief is made again with the English the simulation measured (#12).
    expect(fixture.briefs.startFor).toHaveBeenCalledWith(candidateId, expect.objectContaining({ cefrEstimate: expect.anything() }));
    expect(fixture.gateway.simulationAssessment).toHaveBeenCalledWith({
      candidateId, scenarioId: 'conflict-resolution', mode: 'voice',
      turns: [{ turnId: 'turn_01', speaker: 'candidate', text: '[redacted] will listen',
        startedAt: '2026-09-25T10:05:00.000Z', endedAt: '2026-09-25T10:05:20.000Z' }],
    });
    expect(fixture.stored()).toMatchObject({ status: 'ready' });
    expect(fixture.stored()?.result).not.toHaveProperty('candidateFeedback');
    expect(fixture.stored()?.feedback).not.toHaveProperty('scores');
    const report = await fixture.service.get(assessmentId);
    expect(report).toMatchObject({
      assessmentId, simulationId, candidateId, candidateLabel: 'Candidate A',
      simulation: { characterName: 'Dana', accommodation: false, durationSeconds: 420,
        turns: [{ turnId: 'turn_01', text: 'Ada Example will listen' }] },
    });
    expect(report.scores).toHaveLength(5);
    const feedback = await fixture.service.feedback(assessmentId);
    expect(feedback).toMatchObject({ assessmentId, scenarioTitle: 'A teammate is about to walk away' });
    expect(feedback).not.toHaveProperty('scores');
    expect(feedback).not.toHaveProperty('english');
    expect(fixture.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'assessment.ready' }));
  });

  it('re-runs a finished simulation and propagates ML errors while storing failed status', async () => {
    const fixture = harness();
    await fixture.service.startAutomatically(simulationId);
    fixture.gateway.simulationAssessment.mockRejectedValueOnce(
      new HttpException({ code: 'AI_UNAVAILABLE', message: 'Synthetic outage' }, 503),
    );
    await expect(fixture.service.rerun(simulationId)).rejects.toMatchObject({
      status: 503, response: { code: 'AI_UNAVAILABLE' },
    });
    expect(fixture.stored()).toMatchObject({ status: 'failed' });
    await expect(fixture.service.get(assessmentId)).rejects.toMatchObject({ status: 404 });
    await expect(fixture.service.feedback(assessmentId)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects feedback with a score or decision wording instead of exposing it', async () => {
    const fixture = harness();
    fixture.gateway.simulationAssessment.mockResolvedValueOnce({
      ...contractExample<Record<string, unknown>>('ml/simulation-assessment.response.json'),
      candidateFeedback: { strengths: ['Score 4'], growth: [], nextTime: [] },
    });
    await fixture.service.startAutomatically(simulationId);
    expect(fixture.stored()).toMatchObject({ status: 'failed' });
    await expect(fixture.service.feedback(assessmentId)).rejects.toMatchObject({ status: 404 });
  });
});
