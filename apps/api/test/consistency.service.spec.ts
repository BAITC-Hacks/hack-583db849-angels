import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { contractExample } from '../src/contract-example';
import { ConsistencyService } from '../src/modules/consistency/consistency.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

const candidateId = '00000000-0000-4000-8000-00000000000a';
const brief = contractExample<{ consistency: unknown[] }>('ml/brief.response.json');
const after = contractExample<{ items: unknown[] }>('ml/consistency-after.response.json');
const transcript = [
  { turnId: 'iturn_01', speaker: 'interviewer', text: 'Tell me about the robot.', startSec: 0, endSec: 4 },
  { turnId: 'iturn_02', speaker: 'candidate', text: 'Ada Example fixed the arm overnight.', startSec: 4, endSec: 9 },
];

function harness({ scores = true, transcriptStatus = 'ready', briefReady = true, mlFails = false, demo = false, spoken = transcript as unknown[] } = {}) {
  const reports: { id: string; status: string; result: unknown; interviewId: string; createdAt: Date }[] = [];
  const interview = {
    id: 'interview-1', candidateId, transcriptStatus, transcript: spoken, interviewerScore: scores ? { id: 'scores-1' } : null,
    candidate: {
      id: candidateId, externalId: 'inv-2026-demo-a', profile: { fullName: 'Ada Example' },
      application: { answers: [{ fieldId: 'english_self', question: 'Your English?', answer: 'C2, says Ada Example.' }] },
      test: { answers: [] }, englishCertificate: null,
    },
  };
  const prisma = {
    brief: { findFirst: jest.fn().mockResolvedValue(briefReady ? { result: brief, createdAt: new Date('2026-09-25T09:00:00Z') } : null) },
    interview: {
      findFirst: jest.fn().mockResolvedValue(interview),
      findUnique: jest.fn().mockResolvedValue(interview),
    },
    simulation: {
      findFirst: jest.fn().mockResolvedValue({
        turns: [{ sequence: 1, speaker: 'character', text: 'I am done.', startedAt: new Date('2026-09-25T10:05:00Z'), endedAt: null, createdAt: new Date('2026-09-25T10:05:00Z') }],
      }),
    },
    assessment: { findFirst: jest.fn().mockResolvedValue({ result: { english: { cefrEstimate: 'B2' } } }) },
    consistencyReport: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { status: string | { in: string[] } } }) => {
        const statuses = typeof where.status === 'string' ? [where.status] : where.status.in;
        return Promise.resolve([...reports].reverse().find((report) => statuses.includes(report.status)) ?? null);
      }),
      create: jest.fn().mockImplementation(({ data }: { data: { interviewId: string } }) => {
        const report = { id: `report-${reports.length + 1}`, status: 'pending', result: null, interviewId: data.interviewId, createdAt: new Date() };
        reports.push(report);
        return Promise.resolve({ id: report.id });
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(reports.find((report) => report.id === where.id)!, data);
        return Promise.resolve({});
      }),
    },
  };
  const gateway = { consistency: mlFails ? jest.fn().mockRejectedValue(new Error('AI_UNAVAILABLE')) : jest.fn().mockResolvedValue(after) };
  const config = { get: (key: string) => (key === 'DEMO_MODE' ? String(demo) : undefined) };
  const service = new ConsistencyService(prisma as never, gateway as never, new ToLlmViewService(), config as never);
  return { service, gateway, reports };
}

describe('ConsistencyService', () => {
  it('serves the before stage from the latest brief, and 404 before there is one', async () => {
    await expect(harness().service.before(candidateId)).resolves.toMatchObject({ stage: 'before', items: brief.consistency });
    await expect(harness({ briefReady: false }).service.before(candidateId))
      .rejects.toMatchObject({ status: 404, response: { code: 'CONSISTENCY_NOT_FOUND' } });
  });

  it('keeps the after stage locked until the interviewer’s scores are saved', async () => {
    const { service, gateway } = harness({ scores: false });
    await expect(service.after(candidateId)).rejects.toMatchObject({ status: 409, response: { code: 'DRAFT_LOCKED' } });
    await service.startAfter('interview-1');
    expect(gateway.consistency).not.toHaveBeenCalled();
  });

  it('makes the after stage from the interview, redacted, and never sends the scores', async () => {
    const { service, gateway } = harness();
    await expect(service.after(candidateId)).rejects.toMatchObject({ status: 404, response: { code: 'CONSISTENCY_NOT_FOUND' } });
    await service.startAfter('interview-1');

    const sent = gateway.consistency.mock.calls[0][0];
    expect(sent).toMatchObject({ stage: 'after', simulationEnglish: { cefrEstimate: 'B2' } });
    expect(sent.simulationTurns[0]).toMatchObject({ turnId: 'turn_01', speaker: 'character' });
    expect(sent.interviewTranscript).toHaveLength(2);
    expect(JSON.stringify(sent)).not.toMatch(/Ada Example|profile|inv-2026-demo-a|interviewerScore|scores-1/);
    await expect(service.after(candidateId)).resolves.toMatchObject({ stage: 'after', items: after.items });
  });

  it('makes it once, and waits for the transcript', async () => {
    const once = harness();
    await once.service.startAfter('interview-1');
    await once.service.startAfter('interview-1');
    expect(once.gateway.consistency).toHaveBeenCalledTimes(1);

    const waiting = harness({ transcriptStatus: 'transcribing' });
    await waiting.service.startAfter('interview-1');
    expect(waiting.gateway.consistency).not.toHaveBeenCalled();
  });

  it('keeps a failure as failed instead of throwing', async () => {
    const { service, reports } = harness({ mlFails: true });
    await expect(service.startAfter('interview-1')).resolves.toBeUndefined();
    expect(reports).toEqual([expect.objectContaining({ status: 'failed' })]);
  });

  it('sends the brief’s own items, so the after stage updates them in place', async () => {
    const { service, gateway } = harness();
    await service.startAfter('interview-1');
    expect(gateway.consistency.mock.calls[0][0].beforeItems).toEqual(brief.consistency);
  });

  it('in DEMO_MODE gives a seed candidate’s own interview the seed’s after stage, with no model call', async () => {
    const seed = (name: string) => JSON.parse(readFileSync(resolve(__dirname, '../../../seed/candidates/a', name), 'utf8'));
    const { service, gateway, reports } = harness({ demo: true, spoken: seed('interview-transcript.json') });
    await service.startAfter('interview-1');
    expect(gateway.consistency).not.toHaveBeenCalled();
    expect(reports[0]).toMatchObject({ status: 'ready', result: seed('expected-consistency-after.json') });
  });
});
