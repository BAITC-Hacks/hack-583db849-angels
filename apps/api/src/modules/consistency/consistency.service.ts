import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import type { components } from '../../ai-client/schema';
import { PrismaService } from '../../database/prisma.service';
import { candidateSnapshot, snapshotSelect } from '../../privacy/candidate-snapshot';
import { ToLlmViewService } from '../../privacy/to-llm-view.service';
import { ConsistencyReportDto } from './dto/consistency.dto';

type ConsistencyResult = components['schemas']['ConsistencyResult'];
type EnglishMetrics = components['schemas']['EnglishMetrics'];
type InterviewTurn = components['schemas']['InterviewTurn'];

@Injectable()
export class ConsistencyService {
  private readonly logger = new Logger(ConsistencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly privacy: ToLlmViewService,
  ) {}

  /** Before the interview: the latest ready brief's own consistency block — no separate call. */
  async before(candidateId: string): Promise<ConsistencyReportDto> {
    const brief = await this.prisma.brief.findFirst({
      where: { candidateId, status: 'ready' },
      orderBy: { createdAt: 'desc' },
      select: { result: true, createdAt: true },
    });
    if (!brief?.result) this.notFound();
    const items = (brief.result as unknown as { consistency?: ConsistencyReportDto['items'] }).consistency ?? [];
    return { candidateId, stage: 'before', createdAt: brief.createdAt.toISOString(), items };
  }

  /** After the interview — locked, like the draft, until the interviewer's own scores are saved. */
  async after(candidateId: string): Promise<ConsistencyReportDto> {
    const interview = await this.prisma.interview.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { interviewerScore: { select: { id: true } } },
    });
    if (!interview?.interviewerScore) {
      throw new ConflictException({ code: 'DRAFT_LOCKED', message: "The after stage opens once the interviewer's scores are saved." });
    }
    const report = await this.prisma.consistencyReport.findFirst({
      where: { candidateId, status: 'ready' },
      orderBy: { createdAt: 'desc' },
      select: { result: true, createdAt: true },
    });
    if (!report?.result) this.notFound();
    return { candidateId, stage: 'after', createdAt: report.createdAt.toISOString(), items: (report.result as unknown as ConsistencyResult).items as ConsistencyReportDto['items'] };
  }

  /**
   * Makes the after stage once the interview has a transcript and the
   * interviewer's scores are saved. ML reads the candidate's answers, the
   * simulation and the interview — redacted — and never the scores. It never
   * throws: a failure is kept as failed.
   */
  async startAfter(interviewId: string): Promise<void> {
    try {
      const interview = await this.prisma.interview.findUnique({
        where: { id: interviewId },
        select: {
          id: true, candidateId: true, transcriptStatus: true, transcript: true, interviewerScore: { select: { id: true } },
          candidate: { select: { id: true, ...snapshotSelect } },
        },
      });
      if (!interview?.interviewerScore || interview.transcriptStatus !== 'ready') return;
      const existing = await this.prisma.consistencyReport.findFirst({
        where: { interviewId, status: { in: ['pending', 'ready'] } }, select: { id: true },
      });
      if (existing) return;

      const profile = interview.candidate.profile as Record<string, unknown>;
      const redact = (text: string) => this.privacy.redactText(profile, text);
      const [simulation, assessment] = await Promise.all([
        this.prisma.simulation.findFirst({
          where: { candidateId: interview.candidateId, status: 'completed' },
          orderBy: { createdAt: 'desc' },
          select: { turns: { orderBy: { sequence: 'asc' }, select: { sequence: true, speaker: true, text: true, startedAt: true, endedAt: true, createdAt: true } } },
        }),
        this.prisma.assessment.findFirst({
          where: { candidateId: interview.candidateId, status: 'ready' }, orderBy: { createdAt: 'desc' }, select: { result: true },
        }),
      ]);

      const pending = await this.prisma.consistencyReport.create({
        data: { candidateId: interview.candidateId, interviewId, status: 'pending' }, select: { id: true },
      });
      try {
        const result = await this.gateway.consistency({
          stage: 'after',
          candidate: this.privacy.toLlmView(interview.candidateId, candidateSnapshot(interview.candidate)),
          simulationEnglish: (assessment?.result as { english?: EnglishMetrics } | null)?.english ?? null,
          simulationTurns: (simulation?.turns ?? []).map((turn) => ({
            turnId: `turn_${String(turn.sequence).padStart(2, '0')}`,
            speaker: turn.speaker as 'candidate' | 'character',
            text: redact(turn.text),
            startedAt: (turn.startedAt ?? turn.createdAt).toISOString(),
            endedAt: (turn.endedAt ?? turn.createdAt).toISOString(),
          })),
          interviewTranscript: (interview.transcript as unknown as InterviewTurn[]).map((turn) => ({ ...turn, text: redact(turn.text) })),
        });
        await this.prisma.consistencyReport.update({ where: { id: pending.id }, data: { status: 'ready', result: result as unknown as Prisma.InputJsonValue } });
      } catch (error) {
        await this.prisma.consistencyReport.update({ where: { id: pending.id }, data: { status: 'failed' } });
        throw error;
      }
    } catch (error) {
      this.logger.error(`Consistency after interview ${interviewId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'CONSISTENCY_NOT_FOUND', message: 'This stage has not been prepared yet.' });
  }
}
