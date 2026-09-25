import { contractExample } from '../src/contract-example';
import { QualityGuardService } from '../src/modules/quality-guard/quality-guard.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

const interviewId = '6f1c2a0e-0000-4000-8000-00000000a004';
const interviewResult = contractExample<Record<string, unknown>>('ml/quality-check-interview.response.json');
const calibrationResult = contractExample<Record<string, unknown>>('ml/quality-check-calibration.response.json');

function harness({ transcript = null as unknown, demo = true } = {}) {
  const rows: Record<string, unknown>[] = [];
  const prisma = {
    interview: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === interviewId ? { id: interviewId, transcript, candidate: { profile: { fullName: 'Ada Example' } } } : null)),
    },
    qualityCheck: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return Promise.resolve(data);
      }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  const gateway = {
    qualityCheck: jest.fn().mockImplementation(({ kind }: { kind: string }) =>
      Promise.resolve(kind === 'interview' ? interviewResult : calibrationResult)),
  };
  const config = { get: (name: string) => (name === 'DEMO_MODE' ? String(demo) : undefined) };
  const service = new QualityGuardService(prisma as never, gateway as never, new ToLlmViewService(), config as never);
  return { service, prisma, gateway, rows };
}

const transcript = [
  { turnId: 'iturn_01', speaker: 'interviewer', text: 'Tell me about the robot, Ada Example.', startSec: 0, endSec: 4 },
  { turnId: 'iturn_02', speaker: 'candidate', text: 'It broke two days before the final.', startSec: 4, endSec: 9 },
];

describe('QualityGuardService', () => {
  it('checks an interview from its transcript, with the profile redacted, and stores it', async () => {
    const { service, gateway, rows } = harness({ transcript });
    const check = await service.interview(interviewId);

    const sent = gateway.qualityCheck.mock.calls[0][0];
    expect(sent).toMatchObject({ kind: 'interview', history: [] });
    expect(sent.transcript).toHaveLength(2);
    expect(JSON.stringify(sent)).not.toContain('Ada Example');
    expect(check).toMatchObject({ kind: 'interview', interviewId, interviewerRef: null, from: null, to: null, drift: [] });
    expect(check.signals.length).toBeGreaterThan(0);
    expect(rows).toEqual([expect.objectContaining({ id: check.qualityCheckId, kind: 'interview', interviewId, result: check })]);
  });

  it('answers 409 TRANSCRIPT_MISSING before the transcript exists, and 404 for an unknown interview', async () => {
    await expect(harness({ transcript: null }).service.interview(interviewId))
      .rejects.toMatchObject({ status: 409, response: { code: 'TRANSCRIPT_MISSING' } });
    await expect(harness({ transcript: [] }).service.interview(interviewId))
      .rejects.toMatchObject({ status: 409, response: { code: 'TRANSCRIPT_MISSING' } });
    await expect(harness({ transcript }).service.interview('6f1c2a0e-0000-4000-8000-0000000000ff'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('calibrates one interviewer against the whole panel over the period, `to` excluded', async () => {
    const { service, gateway, rows } = harness();
    const check = await service.calibration({ interviewerRef: 'synthetic-interviewer-a', from: '2026-09-01', to: '2026-10-01' });

    const sent = gateway.qualityCheck.mock.calls[0][0];
    expect(sent).toMatchObject({ kind: 'calibration', transcript: [], interviewerRef: 'synthetic-interviewer-a', periodFrom: '2026-09-01', periodTo: '2026-10-01' });
    expect(new Set(sent.history.map((item: { interviewerRef: string }) => item.interviewerRef))).toEqual(new Set(['synthetic-interviewer-a', 'synthetic-interviewer-b']));
    expect(JSON.stringify(sent)).not.toMatch(/candidate|profile/i);
    expect(check).toMatchObject({ kind: 'calibration', interviewId: null, interviewerRef: 'synthetic-interviewer-a', from: '2026-09-01', to: '2026-10-01' });
    expect(rows[0]).toMatchObject({ kind: 'calibration', interviewerRef: 'synthetic-interviewer-a' });

    // The seed history is 10–15 September: ending the period on the 12th leaves two of a's three interviews.
    await expect(service.calibration({ interviewerRef: 'synthetic-interviewer-a', from: '2026-09-01', to: '2026-09-12' }))
      .rejects.toMatchObject({ status: 409, response: { code: 'NOT_ENOUGH_HISTORY', details: { interviews: 2 } } });
  });

  it('refuses an unknown interviewer, a bad date and an empty period', async () => {
    const { service, gateway } = harness();
    await expect(service.calibration({ interviewerRef: 'nobody', from: '2026-09-01', to: '2026-10-01' })).rejects.toMatchObject({ status: 404 });
    await expect(service.calibration({ interviewerRef: 'synthetic-interviewer-a', from: '2026-02-30', to: '2026-10-01' }))
      .rejects.toMatchObject({ status: 400, response: { details: { fields: ['from'] } } });
    await expect(service.calibration({ interviewerRef: 'synthetic-interviewer-a', from: '2026-10-01', to: '2026-10-01' }))
      .rejects.toMatchObject({ status: 400, response: { details: { fields: ['to'] } } });
    expect(gateway.qualityCheck).not.toHaveBeenCalled();
  });

  it('reads no synthetic history outside DEMO_MODE', async () => {
    const { service } = harness({ demo: false });
    await expect(service.calibration({ interviewerRef: 'synthetic-interviewer-a', from: '2026-09-01', to: '2026-10-01' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('lists newest first, filtered by kind and interviewer', async () => {
    const { service, prisma } = harness();
    await service.list({ kind: 'calibration', interviewerRef: 'synthetic-interviewer-a', limit: 5 });
    expect(prisma.qualityCheck.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { kind: 'calibration', interviewerRef: 'synthetic-interviewer-a' }, orderBy: { createdAt: 'desc' }, take: 5,
    }));
    await expect(service.get('6f1c2a0e-0000-4000-8000-0000000000ff')).rejects.toMatchObject({ status: 404 });
  });
});
