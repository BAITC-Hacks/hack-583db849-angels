import { AuditService } from '../src/modules/audit/audit.service';

describe('AuditService', () => {
  it('does not persist sensitive metadata keys', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'audit-id' });
    const service = new AuditService({ auditEvent: { create } } as never);
    await service.record({ action: 'candidate.read', targetType: 'candidate', metadata: { candidateId: 'id', email: 'no', apiKey: 'no', requestId: 'yes' } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: { candidateId: 'id', requestId: 'yes' } }) }));
  });
});
