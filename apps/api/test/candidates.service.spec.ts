import { CandidatesService } from '../src/modules/candidates/candidates.service';
import { Prisma } from '@prisma/client';
import { contractExample } from '../src/contract-example';
import { CandidateProgressDto } from '../src/modules/candidates/dto/candidate.dto';
import { filterProgressForRole } from '../src/modules/candidates/filter-progress-for-role';

describe('CandidatesService', () => {
  const row = {
    id: '00000000-0000-4000-8000-00000000000a',
    externalId: 'inv-2026-demo-a',
    label: 'Candidate A',
    createdAt: new Date('2026-09-23T08:00:00Z'),
    profile: { fullName: 'Synthetic Person', email: 'synthetic@example.test' },
    simulations: [{ id: 'simulation-id', status: 'active', ending: null }],
    assessments: [],
    briefs: [],
    interviews: [],
    interviewSlots: [] as { id: string; startsAt: Date; durationMin: number; candidateId: string; candidateJoinedAt: Date | null; interviewerJoinedAt: Date | null }[],
    consistencyReports: [],
  };
  const briefs = { startFor: jest.fn().mockResolvedValue(undefined) };

  it('selects and returns only the public Candidate DTO for create, list, and GET', async () => {
    const storedRow = { ...row, externalId: 'candidate-John', label: 'Candidate 00000000' };
    const correctedRow = { ...storedRow, label: 'Candidate JOHN' };
    const prisma = { candidate: {
      upsert: jest.fn().mockImplementation(({ update }) => Promise.resolve({ ...storedRow, label: update.label })),
      findMany: jest.fn().mockResolvedValue([correctedRow]),
      findUnique: jest.fn().mockResolvedValue(correctedRow),
    } };
    const service = new CandidatesService(prisma as never, briefs as never);
    briefs.startFor.mockClear();
    const input = {
      externalId: 'candidate-John', profile: row.profile,
      application: { answers: [] }, test: { answers: [] },
    };

    const created = await service.upsert(input);
    const listed = await service.list(false, 'platform');
    const found = await service.find(row.id);

    const upsert = prisma.candidate.upsert.mock.calls[0][0];
    expect(upsert.create.label).toBe('Candidate JOHN');
    expect(upsert.create.id).toBeUndefined();
    expect(upsert.update.label).toBe('Candidate JOHN');
    expect(prisma.candidate.upsert.mock.calls[0][0].select).toEqual({ id: true, externalId: true, label: true, createdAt: true });
    expect(created).toEqual({ candidateId: row.id, externalId: correctedRow.externalId, label: 'Candidate JOHN', createdAt: row.createdAt.toISOString() });
    expect(listed).toEqual({ items: [created] });
    expect(found).toEqual(created);
    expect(JSON.stringify([created, listed, found])).not.toContain('Synthetic Person');
    expect(JSON.stringify([created, listed, found])).not.toContain('profile');
    // The brief is made as soon as the candidate arrives (#12).
    expect(briefs.startFor).toHaveBeenCalledWith(row.id);
  });

  it('includes only the current simulation in progress and omits unstarted steps', async () => {
    const prisma = { candidate: {
      findMany: jest.fn().mockResolvedValue([row]),
      findUnique: jest.fn().mockResolvedValue(row),
    } };
    const service = new CandidatesService(prisma as never, briefs as never);
    const progress = await service.progress(row.id, 'platform');
    const listed = await service.list(true, 'interviewer');

    expect(progress).toEqual({
      candidateId: row.id, label: 'Candidate A', brief: null,
      simulation: { simulationId: 'simulation-id', status: 'active', ending: null },
      assessment: null, interview: null, surprise: null, presentation: null, interviewSlot: null,
      consistency: { before: null, after: null }, accommodation: null,
    });
    expect(listed.items[0].progress).toEqual(progress);
  });

  it('shows the latest interview slot with its status, worked out from the times', async () => {
    const startsAt = new Date(Date.now() - 10 * 60_000);
    const booked = { ...row, interviewSlots: [{ id: 'slot-1', startsAt, durationMin: 30, candidateId: row.id, candidateJoinedAt: null, interviewerJoinedAt: startsAt }] };
    const prisma = { candidate: { findUnique: jest.fn().mockResolvedValue(booked) } };
    const service = new CandidatesService(prisma as never, briefs as never);
    // The interviewer came and the candidate did not, and ten minutes have passed: missed.
    await expect(service.progress(row.id, 'platform')).resolves.toMatchObject({
      interviewSlot: { slotId: 'slot-1', startsAt: startsAt.toISOString(), status: 'missed' },
    });
  });

  it('stores the missing demo certificate as database null', async () => {
    const upsert = jest.fn().mockResolvedValue(row);
    const service = new CandidatesService({ candidate: { upsert } } as never, briefs as never);
    await service.upsert({
      externalId: 'inv-2026-demo-b', profile: {}, application: { answers: [] }, test: { answers: [] },
      englishCertificate: null,
    } as never, 'Candidate B');
    expect(upsert.mock.calls[0][0].create.englishCertificate).toBe(Prisma.DbNull);
    expect(upsert.mock.calls[0][0].create.label).toBe('Candidate B');
    expect(upsert.mock.calls[0][0].update.label).toBe('Candidate B');
  });

  it('filters populated progress by role according to the contract examples', () => {
    const full = contractExample<CandidateProgressDto>('candidate-progress.commission.json');
    expect(filterProgressForRole(full, 'platform')).toEqual(contractExample('candidate-progress.platform.json'));
    expect(filterProgressForRole(full, 'interviewer')).toEqual(contractExample('candidate-progress.interviewer.json'));
    expect(filterProgressForRole(full, 'commission')).toEqual(full);
  });
  it('reports assessment progress after the simulation completes, except to a blind interviewer', async () => {
    const assessed = { ...row, simulations: [{ id: 'simulation-id', status: 'completed', ending: 'completed' }],
      assessments: [{ id: 'assessment-id', status: 'pending' }] };
    const prisma = { candidate: { findUnique: jest.fn().mockResolvedValue(assessed) } };
    const service = new CandidatesService(prisma as never, briefs as never);
    expect((await service.progress(row.id, 'commission'))?.assessment).toEqual({
      assessmentId: 'assessment-id', status: 'pending',
    });
    expect((await service.progress(row.id, 'platform'))?.assessment).toEqual({
      assessmentId: 'assessment-id', status: 'pending',
    });
    expect((await service.progress(row.id, 'interviewer'))?.assessment).toBeNull();
  });

  it('shows staff the text-mode accommodation and keeps it from the candidate channel', async () => {
    const accommodated = { ...row, accommodation: { textMode: true, reason: 'No microphone at home' } };
    const prisma = { candidate: { findUnique: jest.fn().mockResolvedValue(accommodated) } };
    const service = new CandidatesService(prisma as never, briefs as never);
    for (const role of ['commission', 'admin', 'interviewer'] as const) {
      expect((await service.progress(row.id, role))?.accommodation).toEqual({ textMode: true, reason: 'No microphone at home' });
    }
    expect((await service.progress(row.id, 'platform'))?.accommodation).toBeNull();
  });

  it('shows staff where the interview is, and the candidate channel nothing of it', async () => {
    const interviewed = { ...row, interviews: [{ id: 'interview-id', transcriptStatus: 'ready', interviewerScore: { id: 'scores-id' }, drafts: [] }] };
    const prisma = { candidate: { findUnique: jest.fn().mockResolvedValue(interviewed) } };
    const service = new CandidatesService(prisma as never, briefs as never);
    expect((await service.progress(row.id, 'interviewer'))?.interview).toEqual({
      interviewId: 'interview-id', transcriptStatus: 'ready', scoresSaved: true, draftReady: false,
    });
    expect((await service.progress(row.id, 'platform'))?.interview).toBeNull();
  });

  it('keeps the after-interview consistency locked until the scores, then shows where it is', async () => {
    const interview = { id: 'interview-id', transcriptStatus: 'ready', drafts: [] };
    const unscored = { ...row, briefs: [{ id: 'brief-id', status: 'ready' }], interviews: [{ ...interview, interviewerScore: null }] };
    const scored = { ...unscored, interviews: [{ ...interview, interviewerScore: { id: 'scores-id' } }], consistencyReports: [{ status: 'pending' }] };
    const prisma = { candidate: { findUnique: jest.fn().mockResolvedValueOnce(unscored).mockResolvedValueOnce(scored).mockResolvedValueOnce(scored) } };
    const service = new CandidatesService(prisma as never, briefs as never);
    expect((await service.progress(row.id, 'commission'))?.consistency).toEqual({ before: 'ready', after: 'locked' });
    expect((await service.progress(row.id, 'commission'))?.consistency).toEqual({ before: 'ready', after: 'pending' });
    // The interviewer reads the brief, not the after stage.
    expect((await service.progress(row.id, 'interviewer'))?.consistency).toEqual({ before: 'ready', after: null });
  });

  it('shows every role where the surprise question is, and an unanswered one as expired after its deadline', async () => {
    const opened = { ...row, surprise: { id: 'surprise-id', status: 'started', answerDeadline: new Date(Date.now() + 60_000) } };
    const late = { ...row, surprise: { ...opened.surprise, answerDeadline: new Date(Date.now() - 16_000) } };
    const prisma = { candidate: { findUnique: jest.fn().mockResolvedValueOnce(opened).mockResolvedValueOnce(late) } };
    const service = new CandidatesService(prisma as never, briefs as never);
    expect((await service.progress(row.id, 'platform'))?.surprise).toEqual({ surpriseId: 'surprise-id', status: 'started' });
    expect((await service.progress(row.id, 'platform'))?.surprise).toEqual({ surpriseId: 'surprise-id', status: 'expired' });
  });
});
