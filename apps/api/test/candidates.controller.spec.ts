import { CandidatesController } from '../src/modules/candidates/candidates.controller';

describe('CandidatesController', () => {
  it('never returns a cached F0 Prisma record or its profile', async () => {
    const safeCandidate = {
      candidateId: 'candidate-id', externalId: 'external', label: 'Candidate RNAL', createdAt: '2026-09-23T00:00:00.000Z',
    };
    const candidates = { find: jest.fn().mockResolvedValue(safeCandidate) };
    const idempotency = { execute: jest.fn().mockResolvedValue({ id: 'candidate-id', profile: { email: 'private@example.test' } }) };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-id' }) };
    const controller = new CandidatesController(candidates as never, idempotency as never, audit as never);

    const response = await controller.create(
      { externalId: 'external', profile: { email: 'private@example.test' }, application: { answers: [] }, test: { answers: [] } },
      'key',
      { apiRole: 'platform' } as never,
    );

    expect(response).toEqual(safeCandidate);
    expect(JSON.stringify(response)).not.toContain('profile');
    expect(JSON.stringify(response)).not.toContain('private@example.test');
    expect(audit.record).toHaveBeenCalledWith({
      action: 'candidate.upsert', targetType: 'candidate', targetId: 'candidate-id', candidateId: 'candidate-id', actorRole: 'platform',
    });
  });
});
