import { CandidateAiService } from '../src/ai-client/candidate-ai.service';
import { contractExample } from './contract-example';
import { BriefsService } from '../src/modules/briefs/briefs.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

const candidateId = '00000000-0000-4000-8000-00000000000a';
const briefResult = contractExample<Record<string, unknown>>('ml/brief.response.json');

function harness({ externalId = 'inv-2026-new-0001', demo = false, mlFails = false, surprise = null as unknown } = {}) {
  const candidate = {
    id: candidateId,
    externalId,
    profile: { fullName: 'Ada Example', email: 'ada@example.test', iin: '000000000000' },
    application: {
      answers: [
        { fieldId: 'motivation', question: 'Why inVision U?', answer: 'I, Ada Example, want to build things people use.' },
        { fieldId: 'unused', question: 'Anything else?', answer: 'Nothing cited here.' },
      ],
    },
    test: { answers: [{ itemId: 't1', response: 'Ask the team first.' }] },
    englishCertificate: { type: 'IELTS', score: '6.5' },
    surprise,
  };
  const rows: Record<string, { id: string; candidateId: string; status: string; result: unknown; createdAt: Date }> = {};
  let next = 0;
  const prisma = {
    candidate: { findUnique: jest.fn().mockResolvedValue(candidate) },
    assessment: { findFirst: jest.fn().mockResolvedValue(null) },
    brief: {
      create: jest.fn().mockImplementation(({ data }: { data: { candidateId: string; status: string } }) => {
        const id = `brief-${(next += 1)}`;
        rows[id] = { id, ...data, result: null, createdAt: new Date('2026-09-25T09:00:00Z') };
        return Promise.resolve({ id });
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        rows[where.id] = { ...rows[where.id], ...data } as never;
        return Promise.resolve(rows[where.id]);
      }),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows[where.id] ? { ...rows[where.id], candidate } : null)),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { status?: string } }) => {
        const found = Object.values(rows).reverse().find((row) => !where.status || row.status === where.status);
        return Promise.resolve(found ? { ...found, candidate } : null);
      }),
    },
  };
  const gateway = {
    brief: mlFails ? jest.fn().mockRejectedValue(new Error('AI_UNAVAILABLE')) : jest.fn().mockResolvedValue(briefResult),
  };
  const config = { get: (name: string) => (name === 'DEMO_MODE' ? (demo ? 'true' : 'false') : undefined) };
  const privacy = new ToLlmViewService();
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new BriefsService(prisma as never, new CandidateAiService(privacy, gateway as never), privacy, config as never, audit as never);
  return { service, prisma, gateway, rows, audit };
}

describe('BriefsService', () => {
  it('makes a brief by itself, sending ML only the redacted answers', async () => {
    const { service, gateway, rows, audit } = harness();
    await service.startFor(candidateId);

    expect(gateway.brief).toHaveBeenCalledTimes(1);
    const sent = JSON.stringify(gateway.brief.mock.calls[0][0]);
    expect(sent).not.toMatch(/profile|Ada Example|ada@example\.test|000000000000|inv-2026-new-0001/);
    expect(gateway.brief.mock.calls[0][0]).not.toHaveProperty('simulationEnglish');
    expect(Object.values(rows)).toEqual([expect.objectContaining({ status: 'ready', result: briefResult })]);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'brief.ready', candidateId }));
  });

  it('sends the simulation English when it is made again after the assessment', async () => {
    const { service, gateway } = harness();
    const english = { cefrEstimate: 'B2', wordsPerMinute: 112, fillerRate: 0.03, meanTurnLength: 33.8, lexicalDiversity: 0.71, grammarErrorsPer100Words: 0.8 };
    await service.startFor(candidateId, english);
    expect(gateway.brief.mock.calls[0][0]).toMatchObject({ simulationEnglish: english });
  });

  it('keeps a failure as failed instead of throwing', async () => {
    const { service, rows } = harness({ mlFails: true });
    await expect(service.startFor(candidateId)).resolves.toBeUndefined();
    expect(Object.values(rows)).toEqual([expect.objectContaining({ status: 'failed', result: null })]);
  });

  it('gives the admin the ML error on a re-run', async () => {
    const { service } = harness({ mlFails: true });
    await expect(service.rerun(candidateId)).rejects.toThrow('AI_UNAVAILABLE');
  });

  it('takes A, B and C from the seed in DEMO_MODE, once', async () => {
    const { service, gateway, rows } = harness({ externalId: 'inv-2026-demo-a', demo: true });
    await service.startFor(candidateId);
    await service.startFor(candidateId);
    expect(gateway.brief).not.toHaveBeenCalled();
    expect(Object.values(rows)).toHaveLength(1);
    expect(Object.values(rows)[0]).toMatchObject({ status: 'ready' });
  });

  it('serves the brief with only the cited answers as sources, and no profile', async () => {
    const { service } = harness();
    await service.startFor(candidateId);
    const brief = await service.latestFor(candidateId);

    const cited = new Set(
      [...brief.questions.flatMap((q) => q.evidence), ...brief.clarify.flatMap((t) => t.evidence)]
        .filter((evidence) => evidence.source === 'application_field')
        .map((evidence) => evidence.sourceId),
    );
    for (const answer of brief.sources.application) expect(cited.has(answer.fieldId)).toBe(true);
    expect(brief.sources.application.map((answer) => answer.fieldId)).not.toContain('unused');
    expect(brief.sources.surpriseAnswer).toBeNull();
    expect(JSON.stringify(brief)).not.toMatch(/Ada Example|ada@example\.test|000000000000|"profile"/);
  });

  it('carries the transcribed surprise answer as a source once there is one, and not before', async () => {
    const segments = [{ segmentId: 'sseg_01', text: 'I would talk to the team first.', startSec: 3, endSec: 14.5 }];
    const answered = harness({ surprise: { id: 'surprise-1', status: 'answered', question: 'What would you change?', segments } });
    await answered.service.startFor(candidateId);
    await expect(answered.service.latestFor(candidateId)).resolves.toMatchObject({
      sources: { surpriseAnswer: { surpriseId: 'surprise-1', question: 'What would you change?', segments } },
    });

    const transcribing = harness({ surprise: { id: 'surprise-1', status: 'transcribing', question: 'What would you change?', segments: null } });
    await transcribing.service.startFor(candidateId);
    expect((await transcribing.service.latestFor(candidateId)).sources.surpriseAnswer).toBeNull();
  });

  it('answers 404 BRIEF_NOT_FOUND before a brief is ready, and 404 for an unknown or unfinished one', async () => {
    const { service } = harness({ mlFails: true });
    await expect(service.latestFor(candidateId)).rejects.toMatchObject({ status: 404, response: { code: 'BRIEF_NOT_FOUND' } });
    await service.startFor(candidateId);
    await expect(service.get('brief-1')).rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND' } });
  });
});
