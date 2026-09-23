import { Inject, Injectable } from '@nestjs/common';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import { PrismaService } from '../../database/prisma.service';
import { ScenarioSummaryDto } from './dto/scenario-summary.dto';

const ALL_COMPETENCIES = ['D', 'R', 'I', 'V', 'E'] as const;

@Injectable()
export class ScenariosService {
  constructor(
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly prisma: PrismaService,
  ) {}

  async list(): Promise<ScenarioSummaryDto[]> {
    const [scenarios, counts] = await Promise.all([
      this.gateway.scenarios(),
      this.prisma.simulation.groupBy({ by: ['scenarioId'], _count: { _all: true } }),
    ]);
    const assigned = new Map(counts.map((count) => [count.scenarioId, count._count._all]));
    return scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      status: scenario.status,
      // ScenarioBrief omits competencies; the ML contract guarantees all five for a ready scenario.
      competencies: scenario.status === 'ready' ? [...ALL_COMPETENCIES] : [],
      assignedCount: assigned.get(scenario.scenarioId) ?? 0,
    }));
  }
}
