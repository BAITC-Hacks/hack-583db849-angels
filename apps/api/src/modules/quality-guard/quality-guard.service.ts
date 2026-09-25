import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import type { components } from '../../ai-client/schema';
import { PrismaService } from '../../database/prisma.service';
import { ToLlmViewService } from '../../privacy/to-llm-view.service';
import { CalibrationCheckDto, QualityCheckDto, QualityCheckQueryDto } from './dto/quality-check.dto';

type ScoredInterview = components['schemas']['ScoredInterview'];
type InterviewTurn = components['schemas']['InterviewTurn'];
type QualityCheckResult = components['schemas']['QualityCheckResult'];

/** Fewer interviews than this say nothing about a scale. */
const MIN_INTERVIEWS = 3;

@Injectable()
export class QualityGuardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly privacy: ToLlmViewService,
    private readonly config: ConfigService,
  ) {}

  /**
   * How an interview was run. The ML service reads the whole transcript — the
   * candidate's turns are context and give the talk share — but a finding is
   * only ever about the interviewer's own questions. Anything of the
   * candidate's profile spoken aloud is redacted first.
   */
  async interview(interviewId: string): Promise<QualityCheckDto> {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      select: { id: true, interviewerRef: true, transcript: true, candidate: { select: { profile: true } } },
    });
    if (!interview) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Interview was not found.' });
    const turns = Array.isArray(interview.transcript) ? (interview.transcript as unknown as InterviewTurn[]) : [];
    if (turns.length === 0) {
      throw new ConflictException({ code: 'TRANSCRIPT_MISSING', message: 'The interview has no transcript yet.' });
    }

    const profile = interview.candidate.profile as Record<string, unknown>;
    const transcript = turns.map((turn) => ({
      turnId: turn.turnId, speaker: turn.speaker, text: this.privacy.redactText(profile, turn.text), startSec: turn.startSec, endSec: turn.endSec,
    }));
    const result = await this.gateway.qualityCheck({ kind: 'interview', transcript, history: [] });
    return this.store({ kind: 'interview', interviewId, interviewerRef: interview.interviewerRef, from: null, to: null }, result);
  }

  /**
   * One interviewer's scale against the rest of the panel over a period,
   * `to` excluded. Only pseudonymous scores are sent: no candidate, no name.
   */
  async calibration({ interviewerRef, from, to }: CalibrationCheckDto): Promise<QualityCheckDto> {
    const start = this.day(from, 'from');
    const end = this.day(to, 'to');
    if (end <= start) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '`to` must be after `from`.', details: { fields: ['to'] } });
    }

    const everything = await this.history();
    if (!everything.some((item) => item.interviewerRef === interviewerRef)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'There are no scored interviews for this interviewer.' });
    }
    const history = everything.filter((item) => {
      const heldAt = Date.parse(item.heldAt);
      return heldAt >= start.getTime() && heldAt < end.getTime();
    });
    const own = history.filter((item) => item.interviewerRef === interviewerRef).length;
    if (own < MIN_INTERVIEWS) {
      throw new ConflictException({
        code: 'NOT_ENOUGH_HISTORY',
        message: `Fewer than ${MIN_INTERVIEWS} scored interviews in this period.`,
        details: { interviews: own },
      });
    }

    const result = await this.gateway.qualityCheck({ kind: 'calibration', transcript: [], history, interviewerRef, periodFrom: from, periodTo: to });
    // How many interviews the check read is what was sent, whatever the answer says.
    return this.store({ kind: 'calibration', interviewId: null, interviewerRef, from, to }, { ...result, interviews: history.length });
  }

  async list({ kind, interviewerRef, limit = 20 }: QualityCheckQueryDto): Promise<{ items: QualityCheckDto[] }> {
    const rows = await this.prisma.qualityCheck.findMany({
      where: { ...(kind ? { kind } : {}), ...(interviewerRef ? { interviewerRef } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { result: true },
    });
    return { items: rows.map((row) => row.result as unknown as QualityCheckDto) };
  }

  async get(qualityCheckId: string): Promise<QualityCheckDto> {
    const row = await this.prisma.qualityCheck.findUnique({ where: { id: qualityCheckId }, select: { result: true } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Quality check was not found.' });
    return row.result as unknown as QualityCheckDto;
  }

  /** Every check is a new row: nothing is overwritten, so a panel can see whether a recommendation was followed. */
  private async store(
    scope: Pick<QualityCheckDto, 'kind' | 'interviewId' | 'interviewerRef' | 'from' | 'to'>,
    result: QualityCheckResult,
  ): Promise<QualityCheckDto> {
    const check: QualityCheckDto = {
      qualityCheckId: randomUUID(),
      createdAt: new Date().toISOString(),
      ...scope,
      interviews: result.interviews ?? null,
      talkShare: result.talkShare ?? null,
      drift: result.drift ?? [],
      signals: result.signals.map((signal) => ({
        kind: signal.kind,
        message: signal.message,
        recommendation: signal.recommendation,
        competencies: signal.competencies ?? [],
        evidence: signal.evidence ?? [],
      })),
    };
    await this.prisma.qualityCheck.create({
      data: {
        id: check.qualityCheckId, createdAt: new Date(check.createdAt), kind: scope.kind,
        interviewId: scope.interviewId, interviewerRef: scope.interviewerRef, result: check as unknown as Prisma.InputJsonValue,
      },
    });
    return check;
  }

  /**
   * The scored interviews a calibration reads: every saved set of scores
   * whose interview names its interviewer, pseudonymous — no candidate, no
   * name. In `DEMO_MODE` the synthetic panel in `seed/quality-history.json`
   * joins them, so there is a panel to compare against.
   */
  private async history(): Promise<ScoredInterview[]> {
    const stored = await this.prisma.interview.findMany({
      where: { interviewerRef: { not: null }, interviewerScore: { isNot: null } },
      select: { id: true, interviewerRef: true, heldAt: true, interviewerScore: { select: { scores: true } } },
    });
    const saved: ScoredInterview[] = stored.map((interview) => ({
      interviewRef: interview.id,
      interviewerRef: interview.interviewerRef as string,
      heldAt: interview.heldAt.toISOString(),
      scores: Object.entries(interview.interviewerScore?.scores as Record<string, ScoredInterview['scores'][number]['score']>)
        .map(([competency, score]) => ({ competency: competency as ScoredInterview['scores'][number]['competency'], score })),
    }));
    if (this.config.get<string>('DEMO_MODE') !== 'true') return saved;
    const filename = resolve(process.cwd(), '../../seed/quality-history.json');
    return [...(JSON.parse(await readFile(filename, 'utf8')) as ScoredInterview[]), ...saved];
  }

  private day(value: string, field: 'from' | 'to'): Date {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `\`${field}\` is not a date.`, details: { fields: [field] } });
    }
    return date;
  }
}
