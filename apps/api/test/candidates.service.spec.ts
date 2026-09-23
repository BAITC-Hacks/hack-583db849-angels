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
    simulations: [{ id: 'simulation-id', status: 'active' }],
  };

  it('selects and returns only the public Candidate DTO for create, list, and GET', async () => {
    const prisma = { candidate: {
      upsert: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([row]),
      findUnique: jest.fn().mockResolvedValue(row),
    } };
    const service = new CandidatesService(prisma as never);
    const input = {
      externalId: 'candidate-John', profile: row.profile,
      application: { answers: [] }, test: { answers: [] },
    };

    const created = await service.upsert(input);
    const listed = await service.list(false, 'platform');
    const found = await service.find(row.id);

    const newRecord = prisma.candidate.upsert.mock.calls[0][0].create;
    expect(newRecord.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(newRecord.label).toBe(`Candidate ${newRecord.id.slice(0, 8).toUpperCase()}`);
    expect(newRecord.label).not.toContain('John');
    expect(prisma.candidate.upsert.mock.calls[0][0].select).toEqual({ id: true, externalId: true, label: true, createdAt: true });
    expect(created).toEqual({ candidateId: row.id, externalId: row.externalId, label: row.label, createdAt: row.createdAt.toISOString() });
    expect(listed).toEqual({ items: [created] });
    expect(found).toEqual(created);
    expect(JSON.stringify([created, listed, found])).not.toContain('Synthetic Person');
    expect(JSON.stringify([created, listed, found])).not.toContain('profile');
  });

  it('includes only the current simulation in progress and omits unstarted steps', async () => {
    const prisma = { candidate: {
      findMany: jest.fn().mockResolvedValue([row]),
      findUnique: jest.fn().mockResolvedValue(row),
    } };
    const service = new CandidatesService(prisma as never);
    const progress = await service.progress(row.id, 'platform');
    const listed = await service.list(true, 'interviewer');

    expect(progress).toEqual({
      candidateId: row.id, label: 'Candidate A', brief: null,
      simulation: { simulationId: 'simulation-id', status: 'active', ending: null },
      assessment: null, interview: null, surprise: null,
      consistency: { before: null, after: null },
    });
    expect(listed.items[0].progress).toEqual(progress);
  });

  it('stores the missing demo certificate as database null', async () => {
    const upsert = jest.fn().mockResolvedValue(row);
    const service = new CandidatesService({ candidate: { upsert } } as never);
    await service.upsert({
      externalId: 'inv-2026-demo-b', profile: {}, application: { answers: [] }, test: { answers: [] },
      englishCertificate: null,
    } as never, 'Candidate B');
    expect(upsert.mock.calls[0][0].create.englishCertificate).toBe(Prisma.DbNull);
  });

  it('filters populated progress by role according to the contract examples', () => {
    const full = contractExample<CandidateProgressDto>('candidate-progress.commission.json');
    expect(filterProgressForRole(full, 'platform')).toEqual(contractExample('candidate-progress.platform.json'));
    expect(filterProgressForRole(full, 'interviewer')).toEqual(contractExample('candidate-progress.interviewer.json'));
    expect(filterProgressForRole(full, 'commission')).toEqual(full);
  });
});
