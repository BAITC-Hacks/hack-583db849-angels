import { ScenariosService } from '../src/modules/scenarios/scenarios.service';

describe('ScenariosService', () => {
  it('maps ML scenarios to the public summary and counts existing assignments', async () => {
    const scenarios = jest.fn().mockResolvedValue([
      { scenarioId: 'ready-one', title: 'Ready', status: 'ready' },
      { scenarioId: 'draft-one', title: 'Draft', status: 'draft' },
    ]);
    const prisma = { simulation: { groupBy: jest.fn().mockResolvedValue([
      { scenarioId: 'ready-one', _count: { _all: 2 } },
    ]) } };
    const service = new ScenariosService({ scenarios } as never, prisma as never);

    await expect(service.list()).resolves.toEqual([
      { scenarioId: 'ready-one', title: 'Ready', status: 'ready', competencies: ['D', 'R', 'I', 'V', 'E'], assignedCount: 2 },
      { scenarioId: 'draft-one', title: 'Draft', status: 'draft', competencies: [], assignedCount: 0 },
    ]);
    expect(scenarios).toHaveBeenCalledTimes(1);
  });
});
