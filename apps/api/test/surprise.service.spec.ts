import { CandidateAiService } from '../src/ai-client/candidate-ai.service';
import { contractExample } from '../src/contract-example';
import { SurpriseService } from '../src/modules/surprise/surprise.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

const candidateId = '00000000-0000-4000-8000-00000000000a';
const written = contractExample<{ question: string; competency: string; why: string }>('ml/surprise-question.response.json');
/** A webm file starts with the EBML magic number; the declared type is whatever the browser wrote. */
const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('synthetic video')]);
const video = { buffer: webm, mimetype: 'application/octet-stream', size: webm.length };
const consents = { consentVideo: 'true', consentProcessing: 'true' };

type Row = {
  id: string; candidateId: string; status: string; question: string; competency: string; why: string; answerSeconds: number;
  startedAt: Date | null; answerDeadline: Date | null; videoRef: string | null; segments: unknown; createdAt: Date;
};

function harness({ transcribeFails = false } = {}) {
  const candidate = {
    id: candidateId,
    externalId: 'inv-2026-demo-a',
    profile: { fullName: 'Ada Example', email: 'ada@example.test' },
    application: { answers: [{ fieldId: 'setback', question: 'What went wrong?', answer: 'Our robot broke, Ada Example said.' }] },
    test: { answers: [] },
    englishCertificate: null,
  };
  let row: Row | null = null;
  const where = (filter: { id?: string; status?: string }) => row && (!filter.id || row.id === filter.id) && (!filter.status || row.status === filter.status);
  const prisma = {
    candidate: { findUnique: jest.fn(() => Promise.resolve({ ...candidate, surprise: row ? { id: row.id } : null })) },
    surpriseQuestion: {
      create: jest.fn(({ data }: { data: Partial<Row> }) => {
        row = { id: 'surprise-1', status: 'ready', answerSeconds: 90, startedAt: null, answerDeadline: null, videoRef: null, segments: null, createdAt: new Date(), ...data } as Row;
        return Promise.resolve(row);
      }),
      findUnique: jest.fn(() => Promise.resolve(row ? { ...row } : null)),
      updateMany: jest.fn(({ where: filter, data }: { where: { id: string; status: string }; data: Partial<Row> }) => {
        if (!where(filter)) return Promise.resolve({ count: 0 });
        row = { ...(row as Row), ...data };
        return Promise.resolve({ count: 1 });
      }),
      update: jest.fn(({ data }: { data: Partial<Row> }) => {
        row = { ...(row as Row), ...data };
        return Promise.resolve(row);
      }),
    },
  };
  const gateway = {
    surpriseQuestion: jest.fn().mockResolvedValue(written),
    transcribeSurprise: transcribeFails
      ? jest.fn().mockRejectedValue(new Error('AI_UNAVAILABLE'))
      : jest.fn().mockResolvedValue({
        durationSec: 22,
        turns: [
          { speaker: 'candidate', text: ' I would talk to the team first. ', startSec: 3, endSec: 14.5, confidence: 0.9 },
          { speaker: 'candidate', text: '   ', startSec: 14.5, endSec: 15, confidence: 0.9 },
          { speaker: 'candidate', text: 'I would split the night into shifts.', startSec: 15, endSec: 22, confidence: 0.9 },
        ],
      }),
  };
  const media = {
    saveVideo: jest.fn().mockResolvedValue('surprise/surprise-1/answer.webm'),
    extractAudio: jest.fn().mockResolvedValue('surprise/surprise-1/answer.wav'),
    open: jest.fn().mockResolvedValue({ stream: Buffer.from('v'), type: 'video/webm', length: 1 }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const briefs = { startFor: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const privacy = new ToLlmViewService();
  const service = new SurpriseService(
    prisma as never, new CandidateAiService(privacy, gateway as never), gateway as never, media as never, briefs as never, audit as never,
  );
  return { service, gateway, media, briefs, audit, current: () => row as Row, setRow: (patch: Partial<Row>) => { row = { ...(row as Row), ...patch }; } };
}

/** Lets the transcription that `answer` starts in the background finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SurpriseService', () => {
  it('writes the question from the redacted answers, and shows it to nobody before start', async () => {
    const { service, gateway } = harness();
    const created = await service.create(candidateId, 'platform');

    const sent = JSON.stringify(gateway.surpriseQuestion.mock.calls[0][0]);
    expect(sent).not.toMatch(/profile|Ada Example|ada@example\.test|inv-2026-demo-a/);
    expect(created).toMatchObject({ status: 'ready', question: null, answerSeconds: 90, startedAt: null, answerDeadline: null });
    expect(created).not.toHaveProperty('competency');
    await expect(service.get('surprise-1', 'commission')).resolves.toMatchObject({ question: null, competency: 'D', videoAvailable: false });
  });

  it('allows one question per candidate', async () => {
    const { service } = harness();
    await service.create(candidateId, 'platform');
    await expect(service.create(candidateId, 'platform')).rejects.toMatchObject({
      status: 409, response: { code: 'SURPRISE_EXISTS', details: { surpriseId: 'surprise-1' } },
    });
  });

  it('opens the question once, with a server deadline of reading time plus 90 seconds', async () => {
    const { service } = harness();
    await service.create(candidateId, 'platform');
    const started = await service.start('surprise-1', 'platform');

    expect(started.question).toBe(written.question);
    expect(started).not.toHaveProperty('why');
    expect(Date.parse(started.answerDeadline as string) - Date.parse(started.startedAt as string)).toBe(100_000);
    await expect(service.start('surprise-1', 'platform')).rejects.toMatchObject({ status: 409, response: { code: 'ALREADY_STARTED' } });
  });

  it('refuses an answer without both consents, before start, or after the deadline', async () => {
    const { service, current, setRow, media } = harness();
    await service.create(candidateId, 'platform');
    await expect(service.answer('surprise-1', video, { consentVideo: 'true' }, 'platform'))
      .rejects.toMatchObject({ status: 400, response: { code: 'CONSENT_REQUIRED' } });
    await expect(service.answer('surprise-1', video, consents, 'platform')).rejects.toMatchObject({ status: 400 });

    await service.start('surprise-1', 'platform');
    setRow({ answerDeadline: new Date(Date.now() - 16_000) });
    await expect(service.answer('surprise-1', video, consents, 'platform'))
      .rejects.toMatchObject({ status: 409, response: { code: 'DEADLINE_PASSED' } });
    expect(current().status).toBe('expired');
    expect(media.saveVideo).not.toHaveBeenCalled();
  });

  it('takes a webm or mp4 by its content, whatever type it was declared with, and nothing else', async () => {
    const { service, media } = harness();
    await service.create(candidateId, 'platform');
    await service.start('surprise-1', 'platform');
    const text = Buffer.from('not a video at all');
    await expect(service.answer('surprise-1', { buffer: text, mimetype: 'video/webm', size: text.length }, consents, 'platform'))
      .rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_ERROR', details: { fields: ['video'] } } });
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom synthetic')]);
    await service.answer('surprise-1', { buffer: mp4, mimetype: 'video/mp4;codecs=avc1,mp4a', size: mp4.length }, consents, 'platform');
    expect(media.saveVideo).toHaveBeenCalledWith('surprise-1', 'mp4', mp4);
  });

  it('keeps the video, transcribes only its audio, deletes the audio and makes a new brief', async () => {
    const { service, current, media, gateway, briefs } = harness();
    await service.create(candidateId, 'platform');
    await service.start('surprise-1', 'platform');

    const answered = await service.answer('surprise-1', video, consents, 'platform');
    expect(answered).toMatchObject({ status: 'transcribing' });
    expect(answered).not.toHaveProperty('videoAvailable');
    await settle();

    expect(gateway.transcribeSurprise).toHaveBeenCalledWith('surprise/surprise-1/answer.wav');
    expect(media.delete).toHaveBeenCalledWith('surprise/surprise-1/answer.wav');
    expect(media.delete).not.toHaveBeenCalledWith('surprise/surprise-1/answer.webm');
    expect(current()).toMatchObject({
      status: 'answered',
      videoRef: 'surprise/surprise-1/answer.webm',
      segments: [
        { segmentId: 'sseg_01', text: 'I would talk to the team first.', startSec: 3, endSec: 14.5 },
        { segmentId: 'sseg_02', text: 'I would split the night into shifts.', startSec: 15, endSec: 22 },
      ],
    });
    expect(briefs.startFor).toHaveBeenCalledWith(candidateId);
    await expect(service.answer('surprise-1', video, consents, 'platform')).rejects.toMatchObject({ status: 409, response: { code: 'ALREADY_ANSWERED' } });
  });

  it('marks a failed transcription as failed, and still deletes the audio', async () => {
    const { service, current, media, briefs } = harness({ transcribeFails: true });
    await service.create(candidateId, 'platform');
    await service.start('surprise-1', 'platform');
    await service.answer('surprise-1', video, consents, 'platform');
    await settle();

    expect(current().status).toBe('failed');
    expect(media.delete).toHaveBeenCalledWith('surprise/surprise-1/answer.wav');
    expect(briefs.startFor).not.toHaveBeenCalled();
  });

  it('plays the video to staff only, and writes every view to the audit log', async () => {
    const { service, audit } = harness();
    await service.create(candidateId, 'platform');
    await expect(service.video('surprise-1', 'commission')).rejects.toMatchObject({ status: 404 });
    await service.start('surprise-1', 'platform');
    await service.answer('surprise-1', video, consents, 'platform');
    await settle();

    await expect(service.video('surprise-1', 'platform')).rejects.toMatchObject({ status: 403 });
    await service.video('surprise-1', 'interviewer');
    await service.video('surprise-1', 'commission');
    const actions = audit.record.mock.calls.map(([event]: [{ action: string }]) => event.action);
    expect(actions.filter((action: string) => action === 'surprise.video.viewed')).toHaveLength(2);
    expect(actions.slice(0, 2)).toEqual(['surprise.started', 'surprise.answered']);
    expect(audit.record).toHaveBeenLastCalledWith(expect.objectContaining({
      action: 'surprise.video.viewed', targetId: 'surprise-1', candidateId, actorRole: 'commission',
    }));
  });
});
