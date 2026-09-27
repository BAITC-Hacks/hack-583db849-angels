import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import type { components } from '../../ai-client/schema';
import { ApiRole } from '../../auth/roles';
import { PrismaService } from '../../database/prisma.service';
import { candidateSnapshot, snapshotSelect } from '../../privacy/candidate-snapshot';
import { ToLlmViewService } from '../../privacy/to-llm-view.service';
import { readSeed, seedLetter } from '../../seed-files';
import { AuditService } from '../audit/audit.service';
import { FollowUpDto, FollowUpListDto, FollowUpSegmentDto, FollowUpSuggestionDto } from './dto/follow-up.dto';
import { InterviewAudioService, AudioExtension } from './interview-audio.service';
import { UploadedAudio } from './interviews.service';

type FollowUpResult = components['schemas']['FollowUpResult'];
type FollowUpRequest = components['schemas']['FollowUpRequest'];
type Row = Prisma.InterviewFollowUpGetPayload<object>;

function normalizeQuote(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();
}

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly audio: InterviewAudioService,
    private readonly privacy: ToLlmViewService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(interviewId: string, upload: UploadedAudio | undefined, question: unknown, sample: boolean, role: ApiRole): Promise<FollowUpDto> {
    const context = await this.context(interviewId);
    await this.guard(interviewId, context);
    if (question !== undefined && (typeof question !== 'string' || question.length > 500)) this.invalid('question');
    const seeded = sample && !upload && this.config.get<string>('DEMO_MODE') === 'true' ? await this.sample(context.candidate.externalId) : null;
    const selectedQuestion = seeded?.question ?? (typeof question === 'string' && question.trim() ? question.trim() : null);
    let answer: FollowUpSegmentDto[];
    if (seeded) {
      answer = seeded.segments;
    } else {
      const extension = upload && upload.size <= 5 * 1024 * 1024 ? this.audio.extension(upload.buffer) : null;
      if (upload && upload.size > 5 * 1024 * 1024) {
        throw new HttpException({ code: 'PAYLOAD_TOO_LARGE', message: 'The clip is at most 5 MB.' }, HttpStatus.PAYLOAD_TOO_LARGE);
      }
      if (!upload || !extension) this.invalid('audio');
      answer = await this.transcribe(interviewId, upload, extension);
    }
    const previous = await this.prisma.interviewFollowUp.findMany({ where: { interviewId }, orderBy: { createdAt: 'asc' } });
    const brief = await this.prisma.brief.findFirst({ where: { candidateId: context.candidateId, status: 'ready' }, orderBy: { createdAt: 'desc' }, select: { result: true } });
    const questions = (brief?.result as { questions?: { focus: string; question: string }[] } | null)?.questions ?? [];
    const profile = context.candidate.profile as Record<string, unknown>;
    const request: FollowUpRequest = {
      candidate: this.privacy.toLlmView(context.candidateId, candidateSnapshot(context.candidate)),
      plannedQuestions: questions.map(({ focus, question: text }) => ({ focus, question: text })),
      question: selectedQuestion,
      answer: answer.map((segment) => ({ ...segment, text: this.privacy.redactText(profile, segment.text) })),
      earlier: previous.flatMap((item) => (item.suggestions as unknown as FollowUpSuggestionDto[]).map(({ question: text, competency, status }) => ({ question: text, competency, status }))),
    };
    const result: FollowUpResult = await this.gateway.followUp(request);
    const suggestions: FollowUpSuggestionDto[] = result.suggestions.filter((item) => item.evidence.every((evidence) => {
      const source = evidence.source === 'follow_up_answer'
        ? answer.find((segment) => segment.segmentId === evidence.sourceId)?.text
        : evidence.source === 'application_field'
          ? request.candidate.application.answers.find((field) => field.fieldId === evidence.sourceId)?.answer
          : evidence.source === 'test_item'
            ? request.candidate.test.answers.find((test) => test.itemId === evidence.sourceId)?.response : undefined;
      return source !== undefined && normalizeQuote(source).includes(normalizeQuote(evidence.quote));
    })).map((item, index) => ({
      ...item, suggestionId: `fs_${String(index + 1).padStart(2, '0')}`, status: 'open', markedAt: null,
    }));
    const save = () => this.prisma.$transaction(async (tx) => {
      // Consent, saved scores and the limit are checked again at insertion time.
      await this.guard(interviewId, await this.context(interviewId, tx), tx);
      return tx.interviewFollowUp.create({
        data: { interviewId, question: selectedQuestion, segments: answer as unknown as Prisma.InputJsonValue, suggestions: suggestions as unknown as Prisma.InputJsonValue },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    let row: Row;
    try {
      row = await save();
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
      row = await save();
    }
    await this.audit.record({ action: 'follow_up.suggested', targetType: 'interview_follow_up', targetId: row.id, candidateId: context.candidateId, actorRole: role,
      metadata: { interviewerRef: context.interviewerRef } });
    return this.dto(row);
  }

  async list(interviewId: string): Promise<FollowUpListDto> {
    await this.context(interviewId);
    const rows = await this.prisma.interviewFollowUp.findMany({ where: { interviewId }, orderBy: { createdAt: 'desc' } });
    return { items: rows.map((row) => this.dto(row)) };
  }

  async mark(interviewId: string, followUpId: string, suggestionId: string, status: 'asked' | 'dismissed', role: ApiRole): Promise<FollowUpDto> {
    const context = await this.context(interviewId);
    if (context.interviewerScore) this.conflict('SCORES_ALREADY_SAVED');
    const row = await this.prisma.interviewFollowUp.findFirst({ where: { id: followUpId, interviewId } });
    if (!row) this.notFound();
    const suggestions = row.suggestions as unknown as FollowUpSuggestionDto[];
    const target = suggestions.find((item) => item.suggestionId === suggestionId);
    if (!target) this.notFound();
    target.status = status;
    target.markedAt = new Date().toISOString();
    const updated = await this.prisma.interviewFollowUp.update({ where: { id: row.id }, data: { suggestions: suggestions as unknown as Prisma.InputJsonValue } });
    await this.audit.record({ action: 'follow_up.marked', targetType: 'interview_follow_up', targetId: row.id, candidateId: context.candidateId, actorRole: role,
      metadata: { interviewerRef: context.interviewerRef, suggestionId, status } });
    return this.dto(updated);
  }

  private async transcribe(interviewId: string, upload: UploadedAudio, extension: AudioExtension): Promise<FollowUpSegmentDto[]> {
    const audioRef = await this.audio.save(interviewId, extension, upload.buffer);
    try {
      let seconds: number;
      try {
        seconds = await this.audio.durationSeconds(audioRef);
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        throw new HttpException({ code: 'VALIDATION_ERROR', message: 'The clip is not readable audio.', details: { seconds: null } }, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      if (seconds < 3 || seconds > 120) {
        throw new HttpException({ code: 'VALIDATION_ERROR', message: 'The clip must be 3-120 seconds.', details: { seconds } }, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      const result = await this.gateway.transcribeFollowUp(audioRef);
      const answer = result.turns.filter((turn) => turn.text.trim()).map((turn, index) => ({
        segmentId: `fseg_${String(index + 1).padStart(2, '0')}`, text: turn.text, startSec: turn.startSec, endSec: turn.endSec,
      }));
      if (!answer.length) throw new HttpException({ code: 'SPEECH_NOT_RECOGNISED', message: 'No speech was recognised.' }, HttpStatus.UNPROCESSABLE_ENTITY);
      return answer;
    } finally {
      await this.audio.delete(audioRef);
    }
  }

  private async sample(externalId: string): Promise<{ question: string; segments: FollowUpSegmentDto[] } | null> {
    const letter = seedLetter(externalId);
    return letter ? readSeed<{ question: string; segments: FollowUpSegmentDto[] }>('candidates', letter, 'follow-up-answer.json').catch(() => null) : null;
  }

  private async context(interviewId: string, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const row = await db.interview.findUnique({ where: { id: interviewId }, select: {
      candidateId: true, interviewerRef: true, interviewerScore: { select: { id: true } },
      slot: { select: { consentRecording: true } }, candidate: { select: { id: true, ...snapshotSelect } },
    } });
    if (!row) this.notFound();
    return row;
  }

  private async guard(interviewId: string, row: Awaited<ReturnType<FollowUpsService['context']>>, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    if (!row.slot) this.conflict('NOT_A_CALL');
    if (!row.slot.consentRecording) this.conflict('NO_RECORDING_CONSENT');
    if (row.interviewerScore) this.conflict('SCORES_ALREADY_SAVED');
    const count = await db.interviewFollowUp.count({ where: { interviewId } });
    const configured = Number(this.config.get<string>('FOLLOW_UP_LIMIT', '20'));
    if (count >= (Number.isInteger(configured) && configured > 0 ? configured : 20)) {
      throw new HttpException({ code: 'FOLLOW_UP_LIMIT', message: 'The limit for this call was reached.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private dto(row: Row): FollowUpDto {
    return { followUpId: row.id, interviewId: row.interviewId, question: row.question,
      answer: row.segments as unknown as FollowUpSegmentDto[], suggestions: row.suggestions as unknown as FollowUpSuggestionDto[], createdAt: row.createdAt.toISOString() };
  }

  private invalid(field: string): never {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `Invalid ${field}.`, details: { fields: [field] } });
  }

  private conflict(code: string): never {
    throw new ConflictException({ code, message: 'Follow-ups are unavailable for this interview.' });
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Follow-up or interview was not found.' });
  }
}
