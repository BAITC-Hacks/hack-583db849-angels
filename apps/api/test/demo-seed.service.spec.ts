import { DemoSeedService } from '../src/modules/candidates/demo-seed.service';

describe('DemoSeedService', () => {
  it('upserts the three existing synthetic snapshots with non-personal labels in demo mode', async () => {
    const upsert = jest.fn().mockResolvedValue({ candidateId: 'candidate-id' });
    const service = new DemoSeedService({ get: () => 'true' } as never, { upsert } as never);

    await service.onModuleInit();

    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls.map((call) => [call[0].externalId, call[1]])).toEqual([
      ['inv-2026-demo-a', 'Candidate A'],
      ['inv-2026-demo-b', 'Candidate B'],
      ['inv-2026-demo-c', 'Candidate C'],
    ]);
  });

  it('does not read or upsert seed snapshots outside demo mode', async () => {
    const upsert = jest.fn();
    await new DemoSeedService({ get: () => 'false' } as never, { upsert } as never).onModuleInit();
    expect(upsert).not.toHaveBeenCalled();
  });
});
