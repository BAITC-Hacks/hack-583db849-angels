import { PresentationsService } from '../src/modules/presentations/presentations.service';

const candidateId = '00000000-0000-4000-8000-00000000000a';
const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('synthetic presentation video')]);
const video = { buffer: webm, size: webm.length };
const fields = { candidateId, consentVideo: 'true', consentProcessing: 'true' };

type Row = { id: string; candidateId: string; status: string; durationSec: number; videoRef: string | null; segments: unknown; createdAt: Date };

function harness({ duration = 95 as number | null, transcribeFails = false } = {}) {
  let row: Row | null = null;
  const prisma = {
    candidate: { findUnique: jest.fn(() => Promise.resolve({ id: candidateId, presentation: row ? { id: row.id } : null })) },
    presentation: {
      create: jest.fn(({ data }: { data: Partial<Row> }) => {
        row = { id: 'presentation-1', status: 'transcribing', segments: null, createdAt: new Date('2026-09-26T09:00:00Z'), ...data } as Row;
        return Promise.resolve(row);
      }),
      findUnique: jest.fn(() => Promise.resolve(row ? { ...row } : null)),
      update: jest.fn(({ data }: { data: Partial<Row> }) => {
        row = { ...(row as Row), ...data };
        return Promise.resolve(row);
      }),
    },
  };
  const gateway = {
    transcribeSurprise: transcribeFails ? jest.fn().mockRejectedValue(new Error('AI_UNAVAILABLE')) : jest.fn().mockResolvedValue({
      durationSec: 95,
      turns: [
        { speaker: 'candidate', text: ' I want to build things people in my city use. ', startSec: 1, endSec: 30 },
        { speaker: 'candidate', text: 'I led our robotics team to the regional final.', startSec: 31, endSec: 90 },
      ],
    }),
  };
  const media = {
    saveVideo: jest.fn().mockResolvedValue('presentations/candidate/video.webm'),
    durationSeconds: jest.fn().mockResolvedValue(duration),
    extractAudio: jest.fn().mockResolvedValue('presentations/candidate/audio.wav'),
    open: jest.fn().mockResolvedValue({ path: '/synthetic/video.webm', type: 'video/webm', size: 1000 }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const briefs = { startFor: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new PresentationsService(prisma as never, gateway as never, media as never, briefs as never, audit as never);
  return { service, gateway, media, briefs, audit, current: () => row as Row };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PresentationsService', () => {
  it('refuses a presentation without both consents, a bad candidate id or something that is not a video', async () => {
    const { service, media } = harness();
    await expect(service.submit({ ...fields, consentProcessing: 'false' }, video, 'platform')).rejects.toMatchObject({ status: 400, response: { code: 'CONSENT_REQUIRED' } });
    await expect(service.submit({ ...fields, candidateId: 'A' }, video, 'platform')).rejects.toMatchObject({ status: 400, response: { details: { fields: ['candidateId'] } } });
    await expect(service.submit(fields, { buffer: Buffer.from('plain text, not video'), size: 21 }, 'platform'))
      .rejects.toMatchObject({ status: 400, response: { details: { fields: ['video'] } } });
    expect(media.saveVideo).not.toHaveBeenCalled();
  });

  it('keeps it between one and three minutes, and deletes a refused file at once', async () => {
    const short = harness({ duration: 42 });
    await expect(short.service.submit(fields, video, 'platform')).rejects.toMatchObject({ status: 400, response: { code: 'VIDEO_TOO_SHORT' } });
    expect(short.media.delete).toHaveBeenCalledWith('presentations/candidate/video.webm');
    const long = harness({ duration: 240 });
    await expect(long.service.submit(fields, video, 'platform')).rejects.toMatchObject({ status: 413, response: { code: 'PAYLOAD_TOO_LARGE' } });
    expect(long.media.delete).toHaveBeenCalled();
  });

  it('keeps the video, transcribes only its audio, deletes the audio and makes a new brief', async () => {
    const { service, media, briefs, audit, current } = harness();
    const sent = await service.submit(fields, video, 'platform');
    expect(sent).toMatchObject({ status: 'transcribing', durationSec: 95, prompt: expect.stringContaining('why inVision U') });
    expect(sent).not.toHaveProperty('segments');
    expect(sent).not.toHaveProperty('videoAvailable');
    expect(media.saveVideo).toHaveBeenCalledWith(candidateId, 'webm', webm, 'presentations');
    await settle();

    expect(media.delete).toHaveBeenCalledWith('presentations/candidate/audio.wav');
    expect(media.delete).not.toHaveBeenCalledWith('presentations/candidate/video.webm');
    expect(current()).toMatchObject({
      status: 'ready',
      segments: [
        { segmentId: 'pseg_01', text: 'I want to build things people in my city use.', startSec: 1, endSec: 30 },
        { segmentId: 'pseg_02', text: 'I led our robotics team to the regional final.', startSec: 31, endSec: 90 },
      ],
    });
    expect(briefs.startFor).toHaveBeenCalledWith(candidateId);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'presentation.submitted', actorRole: 'platform' }));
    await expect(service.submit(fields, video, 'platform'))
      .rejects.toMatchObject({ status: 409, response: { code: 'PRESENTATION_EXISTS', details: { presentationId: 'presentation-1' } } });
  });

  it('marks a failed transcription as failed and still deletes the audio', async () => {
    const { service, media, current } = harness({ transcribeFails: true });
    await service.submit(fields, video, 'platform');
    await settle();
    expect(current().status).toBe('failed');
    expect(media.delete).toHaveBeenCalledWith('presentations/candidate/audio.wav');
  });

  it('shows the transcript and plays the video to staff only, writing every view to the audit log', async () => {
    const { service, audit } = harness();
    await service.submit(fields, video, 'platform');
    await settle();
    await expect(service.get('presentation-1', 'platform')).resolves.not.toHaveProperty('segments');
    await expect(service.get('presentation-1', 'interviewer')).resolves.toMatchObject({ videoAvailable: true, segments: expect.any(Array) });
    await expect(service.video('presentation-1', 'platform')).rejects.toMatchObject({ status: 403 });
    await service.video('presentation-1', 'commission');
    expect(audit.record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'presentation.video.viewed', actorRole: 'commission' }));
  });

  it('writes one audit line per viewing, not one per range the player asks for', async () => {
    const { service, audit } = harness();
    await service.submit(fields, video, 'platform');
    await settle();
    const views = () => audit.record.mock.calls.filter(([event]: [{ action: string }]) => event.action === 'presentation.video.viewed').length;
    // Safari: a two-byte probe, then the file from the start, then the rest as it plays.
    await service.video('presentation-1', 'interviewer', 'bytes=0-1');
    await service.video('presentation-1', 'interviewer', 'bytes=0-999');
    await service.video('presentation-1', 'interviewer', 'bytes=500-');
    expect(views()).toBe(1);
    // Chrome, watched again from the start.
    await service.video('presentation-1', 'interviewer', 'bytes=0-');
    expect(views()).toBe(2);
  });
});
