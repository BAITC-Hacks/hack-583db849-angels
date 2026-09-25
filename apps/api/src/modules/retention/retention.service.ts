import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiRole } from '../../auth/roles';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SurpriseMediaService } from '../surprise/surprise-media.service';
import { DecisionDateDto } from './decision-date.dto';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/**
 * Candidate videos are personal data and are not kept forever: they go on a
 * demo reset, and 30 days after the commission's decision. The decision is
 * made in inVision's own system; this service only ever learns its date.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly media: SurpriseMediaService,
    private readonly audit: AuditService,
  ) {}

  /** Sweeps once shortly after start, then every hour. Not in tests, which call `sweep` themselves. */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => void this.sweep(), 10_000).unref();
    this.timer = setInterval(() => void this.sweep(), HOUR);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  retentionDays(): number {
    const days = Number(this.config.get<string>('VIDEO_RETENTION_DAYS') ?? 30);
    return Number.isFinite(days) && days >= 0 ? days : 30;
  }

  /** Records when the commission decided. A date in the future is refused: nothing has been decided yet. */
  async setDecisionDate(candidateId: string, decidedAt: string, role: ApiRole): Promise<DecisionDateDto> {
    const date = new Date(decidedAt);
    if (date.getTime() > Date.now() + 60_000) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'The decision date is in the future.', details: { fields: ['decidedAt'] } });
    }
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { id: true } });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    await this.prisma.candidate.update({ where: { id: candidateId }, data: { decidedAt: date } });
    await this.audit.record({ action: 'candidate.decision_dated', targetType: 'candidate', targetId: candidateId, candidateId, actorRole: role });
    return {
      candidateId,
      decidedAt: date.toISOString(),
      videosDeletedAfter: new Date(date.getTime() + this.retentionDays() * DAY).toISOString(),
    };
  }

  /** Deletes every surprise and presentation video whose candidate was decided at least VIDEO_RETENTION_DAYS ago. The transcript stays. */
  async sweep(now = new Date()): Promise<number> {
    const before = new Date(now.getTime() - this.retentionDays() * DAY);
    const due = await this.prisma.surpriseQuestion.findMany({
      where: { videoRef: { not: null }, candidate: { decidedAt: { lte: before } } },
      select: { id: true, candidateId: true, videoRef: true },
    });
    let deleted = 0;
    for (const question of due) {
      try {
        await this.media.delete(question.videoRef as string);
        await this.prisma.surpriseQuestion.update({ where: { id: question.id }, data: { videoRef: null } });
        await this.audit.record({ action: 'surprise.video.deleted', targetType: 'surprise_question', targetId: question.id, candidateId: question.candidateId });
        deleted += 1;
      } catch (error) {
        this.logger.error(`Video of surprise question ${question.id} was not deleted: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const presentations = await this.prisma.presentation.findMany({
      where: { videoRef: { not: null }, candidate: { decidedAt: { lte: before } } },
      select: { id: true, candidateId: true, videoRef: true },
    });
    for (const presentation of presentations) {
      try {
        await this.media.delete(presentation.videoRef as string);
        await this.prisma.presentation.update({ where: { id: presentation.id }, data: { videoRef: null } });
        await this.audit.record({ action: 'presentation.video.deleted', targetType: 'presentation', targetId: presentation.id, candidateId: presentation.candidateId });
        deleted += 1;
      } catch (error) {
        this.logger.error(`Video of presentation ${presentation.id} was not deleted: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (deleted) this.logger.log(`Deleted ${deleted} video(s) past the retention period.`);
    return deleted;
  }
}
