import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import { PrismaService } from '../../database/prisma.service';
import { AUDIT_ACTIONS, AdminOverviewDto, AuditEventDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly config: ConfigService,
  ) {}

  /** The demo at a glance. ML being down is a state to show, not an error. */
  async overview(): Promise<AdminOverviewDto> {
    const [usage, candidates, simulationsCompleted, assessmentsReady, interviewsScored] = await Promise.all([
      this.gateway.usage().catch(() => null),
      this.prisma.candidate.count(),
      this.prisma.simulation.count({ where: { status: 'completed' } }),
      this.prisma.assessment.count({ where: { status: 'ready' } }),
      this.prisma.interviewerScore.count(),
    ]);
    return {
      demoMode: this.config.get<string>('DEMO_MODE') === 'true',
      gatewayMode: usage?.gatewayMode ?? (this.config.get<AdminOverviewDto['gatewayMode']>('GATEWAY_MODE') ?? 'replay'),
      ml: usage ? 'up' : 'down',
      usage: usage
        ? { liveCalls: usage.liveCalls, replayedCalls: usage.replayedCalls, spentUsd: usage.spentUsd, capUsd: usage.capUsd }
        : { liveCalls: 0, replayedCalls: 0, spentUsd: 0, capUsd: 0 },
      modules: (['M1', 'M2', 'M3', 'M4', 'M5', 'S'] as const).map((module) => ({ module, state: 'on' as const })),
      counts: { candidates, simulationsCompleted, assessmentsReady, interviewsScored },
    };
  }

  /**
   * The newest events the contract names, each with who did it. Actions the
   * API keeps only for itself (every simulation turn, accommodation
   * changes) stay out of this list.
   */
  async auditEvents(limit = 50): Promise<{ items: AuditEventDto[] }> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { action: { in: [...AUDIT_ACTIONS] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, createdAt: true, actorRole: true, action: true, candidateId: true, targetId: true, candidate: { select: { label: true } } },
    });
    return {
      items: rows.map((row) => ({
        eventId: row.id,
        at: row.createdAt.toISOString(),
        actorRole: row.actorRole ?? 'system',
        action: row.action as AuditEventDto['action'],
        candidateId: row.candidateId,
        candidateLabel: row.candidate?.label ?? null,
        subjectId: row.targetId,
      })),
    };
  }
}
