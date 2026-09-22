import { CandidatesController } from '../src/modules/candidates/candidates.controller';

describe('CandidatesController', () => {
  it('records a safe audit event after a candidate write', async () => {
    const candidates = { upsert: jest.fn().mockResolvedValue({ id: 'candidate-id' }) };
    const idempotency = { execute: jest.fn(async (_key, _body, create) => create()) };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-id' }) };
    const controller = new CandidatesController(candidates as never, idempotency as never, audit as never);
    await controller.create({ externalId: 'external', profile: { email: 'private@example.test' }, application: { answers: [] }, test: { answers: [] } }, 'key', { apiRole: 'platform' } as never);
    expect(audit.record).toHaveBeenCalledWith({ action: 'candidate.upsert', targetType: 'candidate', targetId: 'candidate-id', candidateId: 'candidate-id', actorRole: 'platform' });
  });
});
