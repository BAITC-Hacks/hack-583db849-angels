import { FollowUpsService } from '../src/modules/interviews/follow-ups.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

const interviewId = '00000000-0000-4000-8000-000000000001';
const candidate = { id: '00000000-0000-4000-8000-00000000000a', externalId: 'inv-2026-demo-a', profile: { name: 'Synthetic Person' },
  application: { answers: [] }, test: { answers: [] }, englishCertificate: null };
const upload = { buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]), size: 12 };
const proposed = { question: 'Who else helped?', competency: 'V', reason: 'no_evidence', why: 'The answer does not name anyone.',
  evidence: [{ source: 'follow_up_answer', sourceId: 'fseg_01', quote: 'I made a plan.' }] };

function harness({ slot = true, consent = true, scores = false, count = 0, demo = false, duration = 4, fail = false } = {}) {
  let row = { candidateId: candidate.id, interviewerRef: 'interviewer-1', candidate, slot: slot ? { consentRecording: consent } : null,
    interviewerScore: scores ? { id: 'score-1' } : null };
  const followUps: { id: string; interviewId: string; question: string | null; segments: unknown; suggestions: unknown; createdAt: Date }[] = [];
  const prisma = {
    $transaction: jest.fn(),
    interview: { findUnique: jest.fn().mockImplementation(() => Promise.resolve(row)) },
    brief: { findFirst: jest.fn().mockResolvedValue({ result: { questions: [{ focus: 'V', question: 'What did you choose?' }] } }) },
    interviewFollowUp: {
      count: jest.fn().mockImplementation(() => Promise.resolve(count + followUps.length)),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(followUps)),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(followUps.find((item) => item.id === where.id))),
      create: jest.fn().mockImplementation(({ data }: { data: typeof followUps[number] }) => {
        const made = { ...data, id: `follow-up-${followUps.length + 1}`, createdAt: new Date('2026-09-27T10:00:00Z') };
        followUps.push(made);
        return Promise.resolve(made);
      }),
      update: jest.fn().mockImplementation(({ data }: { data: { suggestions: unknown } }) => {
        followUps[0].suggestions = data.suggestions;
        return Promise.resolve(followUps[0]);
      }),
    },
  };
  prisma.$transaction.mockImplementation((work: (tx: unknown) => Promise<unknown>) => work(prisma));
  const gateway = {
    transcribeFollowUp: jest.fn().mockImplementation(() => fail ? Promise.reject(new Error('ML down')) : Promise.resolve({
      turns: [{ speaker: 'candidate', text: 'I made a plan.', startSec: 0, endSec: 4 }], durationSec: 4,
    })),
    followUp: jest.fn().mockResolvedValue({ suggestions: [proposed] }),
  };
  const audio = {
    extension: jest.fn().mockReturnValue('webm'), save: jest.fn().mockResolvedValue('interviews/id/answer.webm'),
    durationSeconds: jest.fn().mockResolvedValue(duration), delete: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (key: string, fallback?: string) => key === 'DEMO_MODE' ? String(demo) : fallback };
  const service = new FollowUpsService(prisma as never, gateway as never, audio as never, new ToLlmViewService(), audit as never, config as never);
  return { service, prisma, gateway, audio, audit, followUps,
    setConsent: (value: boolean) => { row = { ...row, slot: { consentRecording: value } }; },
    setScores: () => { row = { ...row, interviewerScore: { id: 'score-1' } }; },
  };
}

describe('FollowUpsService', () => {
  it.each([
    [{ slot: false }, 'NOT_A_CALL'], [{ consent: false }, 'NO_RECORDING_CONSENT'],
    [{ scores: true }, 'SCORES_ALREADY_SAVED'], [{ count: 20 }, 'FOLLOW_UP_LIMIT'],
  ])('enforces the preflight rules %p', async (options, code) => {
    const { service, gateway } = harness(options);
    await expect(service.create(interviewId, upload, undefined, false, 'interviewer')).rejects.toMatchObject({ response: { code } });
    expect(gateway.transcribeFollowUp).not.toHaveBeenCalled();
  });

  it('deletes audio after success and stores only text, open suggestions and an audit without text', async () => {
    const { service, audio, gateway, audit } = harness();
    const result = await service.create(interviewId, upload, 'What did you choose?', false, 'interviewer');
    expect(audio.delete).toHaveBeenCalledWith('interviews/id/answer.webm');
    expect(gateway.transcribeFollowUp).toHaveBeenCalledWith('interviews/id/answer.webm');
    expect(result).toMatchObject({ answer: [{ segmentId: 'fseg_01', text: 'I made a plan.' }],
      suggestions: [{ suggestionId: 'fs_01', status: 'open', markedAt: null }] });
    expect(gateway.followUp).toHaveBeenCalledWith(expect.objectContaining({ plannedQuestions: [{ focus: 'V', question: 'What did you choose?' }] }));
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('I made a plan.');
    expect((await service.list(interviewId)).items).toHaveLength(1);
    expect((await service.mark(interviewId, result.followUpId, 'fs_01', 'asked', 'interviewer')).suggestions[0].status).toBe('asked');
  });

  it('deletes audio on ML error and refuses a short clip', async () => {
    const failed = harness({ fail: true });
    await expect(failed.service.create(interviewId, upload, undefined, false, 'interviewer')).rejects.toThrow('ML down');
    expect(failed.audio.delete).toHaveBeenCalledTimes(1);
    const short = harness({ duration: 2 });
    await expect(short.service.create(interviewId, upload, undefined, false, 'interviewer'))
      .rejects.toMatchObject({ status: 422, response: { code: 'VALIDATION_ERROR', details: { seconds: 2 } } });
    expect(short.audio.delete).toHaveBeenCalledTimes(1);
  });

  it('uses a demo seed without transcription and transcribes real audio even for candidate A', async () => {
    const demo = harness({ demo: true });
    const result = await demo.service.create(interviewId, undefined, 'Another selected question?', true, 'interviewer');
    expect(result.answer[0].segmentId).toBe('fseg_01');
    expect(result.question).not.toBe('Another selected question?');
    expect(demo.gateway.transcribeFollowUp).not.toHaveBeenCalled();
    await demo.service.create(interviewId, upload, undefined, false, 'interviewer');
    await demo.service.create(interviewId, upload, undefined, true, 'interviewer');
    expect(demo.gateway.transcribeFollowUp).toHaveBeenCalledTimes(2);
  });

  it('discards ML output when consent was withdrawn while it was generating', async () => {
    const { service, gateway, prisma, setConsent } = harness();
    gateway.followUp.mockImplementation(async () => { setConsent(false); return { suggestions: [proposed] }; });
    await expect(service.create(interviewId, upload, undefined, false, 'interviewer'))
      .rejects.toMatchObject({ status: 409, response: { code: 'NO_RECORDING_CONSENT' } });
    expect(prisma.interviewFollowUp.create).not.toHaveBeenCalled();
  });

  it('drops evidence that cannot be found verbatim in the saved answer', async () => {
    const { service, gateway } = harness();
    gateway.followUp.mockResolvedValue({ suggestions: [{ ...proposed, evidence: [{ source: 'follow_up_answer', sourceId: 'fseg_01', quote: 'Invented claim' }] }] });
    const result = await service.create(interviewId, upload, undefined, false, 'interviewer');
    expect(result.suggestions).toEqual([]);
  });

  it('does not allow marking suggestions after the interviewer saved scores', async () => {
    const { service, setScores } = harness();
    const result = await service.create(interviewId, upload, undefined, false, 'interviewer');
    setScores();
    await expect(service.mark(interviewId, result.followUpId, 'fs_01', 'asked', 'interviewer'))
      .rejects.toMatchObject({ status: 409, response: { code: 'SCORES_ALREADY_SAVED' } });
  });
});
