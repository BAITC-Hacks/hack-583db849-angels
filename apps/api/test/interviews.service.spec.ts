import { contractExample } from '../src/contract-example';
import { InterviewsService } from '../src/modules/interviews/interviews.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

const candidateId = '00000000-0000-4000-8000-00000000000a';
const draftResult = contractExample<Record<string, unknown>>('ml/interview-draft.response.json');
const transcribed = contractExample<{ turns: { speaker: string; text: string; startSec: number; endSec: number }[] }>('ml/transcribe.response.json');
const platform = contractExample<{ transcript: { speaker: 'interviewer' | 'candidate'; text: string; startSec: number; endSec: number }[] }>(
  'interview-with-transcript.request.json',
);
const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('synthetic interview audio')]);
const scores = { D: 3, R: 2, I: 2, V: null, E: 3 };

type Row = Record<string, unknown> & { id: string; transcriptStatus: string };

function harness({ duration = 900, transcribeFails = false, silent = false } = {}) {
  let interview: Row | null = null;
  let saved: { scores: unknown; savedAt: Date } | null = null;
  const drafts: { id: string; status: string; result: unknown; createdAt: Date }[] = [];
  const candidate = { label: 'Candidate A', profile: { fullName: 'Ada Example' } };
  const row = () => (interview ? { ...interview, candidate, interviewerScore: saved } : null);
  const prisma = {
    candidate: { findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(where.id === candidateId ? { id: candidateId } : null)) },
    interview: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        interview = { id: 'interview-1', ...data, transcript: Array.isArray(data.transcript) ? data.transcript : null } as unknown as Row;
        return Promise.resolve(row());
      }),
      findUnique: jest.fn(() => Promise.resolve(row())),
      updateMany: jest.fn(({ where, data }: { where: { transcriptStatus: { in: string[] } }; data: Record<string, unknown> }) => {
        if (!interview || !where.transcriptStatus.in.includes(interview.transcriptStatus)) return Promise.resolve({ count: 0 });
        interview = { ...interview, ...data };
        return Promise.resolve({ count: 1 });
      }),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        interview = { ...(interview as Row), ...data };
        return Promise.resolve(row());
      }),
    },
    interviewerScore: {
      create: jest.fn(({ data }: { data: { scores: unknown } }) => {
        saved = { scores: data.scores, savedAt: new Date('2026-09-26T10:40:00Z') };
        return Promise.resolve({ savedAt: saved.savedAt });
      }),
    },
    interviewDraft: {
      create: jest.fn(() => {
        const draft = { id: `draft-${drafts.length + 1}`, status: 'pending', result: null, createdAt: new Date() };
        drafts.push(draft);
        return Promise.resolve({ id: draft.id });
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(drafts.find((draft) => draft.id === where.id)!, data);
        return Promise.resolve({});
      }),
      findFirst: jest.fn(({ where }: { where: { status: string | { in: string[] }; id?: string } }) => {
        const statuses = typeof where.status === 'string' ? [where.status] : where.status.in;
        const found = [...drafts].reverse().find((draft) => statuses.includes(draft.status) && (!where.id || draft.id === where.id));
        return Promise.resolve(found ?? null);
      }),
    },
  };
  const gateway = {
    transcribeInterview: transcribeFails
      ? jest.fn().mockRejectedValue(new Error('AI_UNAVAILABLE'))
      : jest.fn().mockResolvedValue(silent ? { turns: [{ speaker: 'candidate', text: '  ', startSec: 0, endSec: 1 }], durationSec: 1 } : transcribed),
    interviewDraft: jest.fn().mockResolvedValue(draftResult),
  };
  const audio = {
    extension: jest.fn((buffer: Buffer) => (buffer.readUInt32BE(0) === 0x1a45dfa3 ? 'webm' : null)),
    save: jest.fn().mockResolvedValue('interviews/interview-1/recording.webm'),
    durationSeconds: jest.fn().mockResolvedValue(duration),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const consistency = { startAfter: jest.fn().mockResolvedValue(undefined) };
  const service = new InterviewsService(prisma as never, gateway as never, audio as never, new ToLlmViewService(), audit as never, consistency as never);
  return { service, gateway, audio, audit, consistency, drafts, current: () => interview as Row };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const upload = { buffer: webm, size: webm.length };

describe('InterviewsService', () => {
  it('takes inVision’s own transcript and gives every turn its id', async () => {
    const { service, audit } = harness();
    const interview = await service.create({
      candidateId, heldAt: '2026-09-26T09:30:00Z', interviewerRef: 'interviewer-2', transcriptSource: 'platform', transcript: platform.transcript,
      notes: ['Asked for a second example.'],
    }, 'interviewer');

    expect(interview).toMatchObject({ transcriptStatus: 'ready', transcriptSource: 'platform', interviewerRef: 'interviewer-2', candidateLabel: 'Candidate A' });
    expect(interview.transcript?.map((turn) => turn.turnId).slice(0, 3)).toEqual(['iturn_01', 'iturn_02', 'iturn_03']);
    expect(interview.notes).toEqual([{ id: 'note_1', text: 'Asked for a second example.' }]);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'interview.created' }));
  });

  it('refuses a transcript that does not say where it came from, and an unknown candidate', async () => {
    const { service } = harness();
    await expect(service.create({ candidateId, heldAt: '2026-09-26T09:30:00Z', transcript: platform.transcript }, 'interviewer'))
      .rejects.toMatchObject({ status: 400 });
    await expect(service.create({ candidateId: '00000000-0000-4000-8000-0000000000ff', heldAt: '2026-09-26T09:30:00Z' }, 'interviewer'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('transcribes a consented recording into turns and deletes the audio', async () => {
    const { service, audio, gateway, current } = harness();
    await service.create({ candidateId, heldAt: '2026-09-26T09:30:00Z' }, 'interviewer');

    await expect(service.recording('interview-1', upload, 'false', 'interviewer')).rejects.toMatchObject({ status: 400, response: { code: 'CONSENT_REQUIRED' } });
    await expect(service.recording('interview-1', { buffer: Buffer.from('not audio at all'), size: 16 }, 'true', 'interviewer'))
      .rejects.toMatchObject({ status: 400, response: { details: { fields: ['audio'] } } });

    const answered = await service.recording('interview-1', upload, 'true', 'interviewer');
    expect(answered).toMatchObject({ transcriptStatus: 'transcribing', transcriptSource: 'recording', transcript: null });
    await settle();

    expect(gateway.transcribeInterview).toHaveBeenCalledWith('interviews/interview-1/recording.webm');
    expect(audio.delete).toHaveBeenCalledWith('interviews/interview-1/recording.webm');
    expect(current().transcriptStatus).toBe('ready');
    expect((current().transcript as { turnId: string }[])).toHaveLength(transcribed.turns.length);
    await expect(service.recording('interview-1', upload, 'true', 'interviewer')).rejects.toMatchObject({ status: 409, response: { code: 'TRANSCRIPT_EXISTS' } });
  });

  it('refuses a recording over 60 minutes and deletes it at once', async () => {
    const { service, audio, current } = harness({ duration: 61 * 60 });
    await service.create({ candidateId, heldAt: '2026-09-26T09:30:00Z' }, 'interviewer');
    await expect(service.recording('interview-1', upload, 'true', 'interviewer')).rejects.toMatchObject({ status: 413, response: { code: 'PAYLOAD_TOO_LARGE' } });
    expect(audio.delete).toHaveBeenCalledWith('interviews/interview-1/recording.webm');
    expect(current().transcriptStatus).toBe('none');
  });

  it('marks a failed transcription as failed, deletes the audio, and takes a new recording after it', async () => {
    const { service, audio, current } = harness({ transcribeFails: true });
    await service.create({ candidateId, heldAt: '2026-09-26T09:30:00Z' }, 'interviewer');
    await service.recording('interview-1', upload, 'true', 'interviewer');
    await settle();
    expect(current().transcriptStatus).toBe('failed');
    expect(audio.delete).toHaveBeenCalled();
    await expect(service.recording('interview-1', upload, 'true', 'interviewer')).resolves.toMatchObject({ transcriptStatus: 'transcribing' });
  });

  it('treats a recording with no speech in it as failed', async () => {
    const { service, current } = harness({ silent: true });
    await service.create({ candidateId, heldAt: '2026-09-26T09:30:00Z' }, 'interviewer');
    await service.recording('interview-1', upload, 'true', 'interviewer');
    await settle();
    expect(current().transcriptStatus).toBe('failed');
  });

  it('needs all five scores, and fixes them once saved', async () => {
    const { service } = harness();
    await service.create({ candidateId, heldAt: '2026-09-26T09:30:00Z' }, 'interviewer');
    await expect(service.saveScores('interview-1', { D: 3, R: 2, I: 2, E: 3 }, 'interviewer'))
      .rejects.toMatchObject({ status: 400, response: { details: { fields: ['scores.V'] } } });
    await expect(service.saveScores('interview-1', { ...scores, D: 7 }, 'interviewer')).rejects.toMatchObject({ status: 400 });

    const first = await service.saveScores('interview-1', scores, 'interviewer');
    expect(first).toMatchObject({ interviewId: 'interview-1', scores });
    await expect(service.saveScores('interview-1', scores, 'interviewer')).resolves.toEqual(first);
    await expect(service.saveScores('interview-1', { ...scores, D: 4 }, 'interviewer'))
      .rejects.toMatchObject({ status: 409, response: { code: 'SCORES_ALREADY_SAVED' } });
  });

  it('keeps the draft locked before the scores — both making it and reading it', async () => {
    const { service, gateway } = harness();
    await service.create({ candidateId, heldAt: '2026-09-26T09:30:00Z', transcriptSource: 'platform', transcript: platform.transcript }, 'interviewer');
    await expect(service.getDraft('interview-1')).rejects.toMatchObject({ status: 409, response: { code: 'DRAFT_LOCKED' } });
    await expect(service.createDraft('interview-1')).rejects.toMatchObject({ status: 409, response: { code: 'DRAFT_LOCKED' } });
    expect(gateway.interviewDraft).not.toHaveBeenCalled();
  });

  it('makes the draft by itself once the scores and the transcript both exist, and never sends the scores', async () => {
    const { service, gateway, consistency } = harness();
    await service.create({ candidateId, heldAt: '2026-09-26T09:30:00Z', notes: ['Ada Example paused before answering.'] }, 'interviewer');
    await service.saveScores('interview-1', scores, 'interviewer');
    await settle();
    // Scores first, no transcript yet: the draft waits for it.
    expect(gateway.interviewDraft).not.toHaveBeenCalled();
    await expect(service.getDraft('interview-1')).rejects.toMatchObject({ status: 404, response: { code: 'DRAFT_NOT_FOUND' } });
    await expect(service.createDraft('interview-1')).rejects.toMatchObject({ status: 409, response: { code: 'TRANSCRIPT_MISSING' } });

    await service.recording('interview-1', upload, 'true', 'interviewer');
    await settle();
    await settle();

    expect(gateway.interviewDraft).toHaveBeenCalledTimes(1);
    // The after-interview consistency starts at the same moment.
    expect(consistency.startAfter).toHaveBeenCalledWith('interview-1');
    const sent = gateway.interviewDraft.mock.calls[0][0];
    expect(Object.keys(sent).sort()).toEqual(['candidateId', 'notes', 'transcript']);
    expect(JSON.stringify(sent)).not.toMatch(/Ada Example|"D":3|interviewerScore/);
    expect(sent.notes).toEqual([{ id: 'note_1', text: '[redacted] paused before answering.' }]);
    const draft = await service.getDraft('interview-1');
    expect(draft.scores).toHaveLength(5);
  });
});
