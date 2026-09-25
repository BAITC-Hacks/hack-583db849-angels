import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SurpriseQuestion } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import { CandidateAiService } from '../../ai-client/candidate-ai.service';
import { ApiRole } from '../../auth/roles';
import { countsAsView, type VideoFile } from '../../media/video-range';
import { PrismaService } from '../../database/prisma.service';
import { candidateSnapshot, snapshotSelect } from '../../privacy/candidate-snapshot';
import { AuditService } from '../audit/audit.service';
import { BriefsService } from '../briefs/briefs.service';
import { SurpriseQuestionDto, SurpriseSegmentDto } from './dto/surprise.dto';
import { SurpriseMediaService, videoContainer, type VideoExtension } from './surprise-media.service';
import { READING_SECONDS, surpriseStatus } from './surprise-status';

export interface UploadedVideo {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** The two consents the candidate gives on the screen, sent as multipart fields. */
export interface AnswerConsents {
  consentVideo?: unknown;
  consentProcessing?: unknown;
}

@Injectable()
export class SurpriseService {
  private readonly logger = new Logger(SurpriseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly candidateAi: CandidateAiService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly media: SurpriseMediaService,
    private readonly briefs: BriefsService,
    private readonly audit: AuditService,
  ) {}

  /** ML writes the question from the candidate's answers now; nobody sees it until `start`. */
  async create(candidateId: string, role: ApiRole): Promise<SurpriseQuestionDto> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true, ...snapshotSelect, surprise: { select: { id: true } } },
    });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    if (candidate.surprise) this.exists(candidate.surprise.id);

    const written = await this.candidateAi.surpriseQuestion(candidate.id, candidateSnapshot(candidate));
    try {
      const row = await this.prisma.surpriseQuestion.create({
        data: { candidateId, question: written.question, competency: written.competency, why: written.why },
      });
      return this.toDto(row, role);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.surpriseQuestion.findUnique({ where: { candidateId }, select: { id: true } });
        if (existing) this.exists(existing.id);
      }
      throw error;
    }
  }

  /** The one attempt: the question, and a deadline the server keeps. */
  async start(surpriseId: string, role: ApiRole): Promise<SurpriseQuestionDto> {
    const row = await this.find(surpriseId);
    const startedAt = new Date();
    const answerDeadline = new Date(startedAt.getTime() + (READING_SECONDS + row.answerSeconds) * 1000);
    const { count } = await this.prisma.surpriseQuestion.updateMany({
      where: { id: surpriseId, status: 'ready' },
      data: { status: 'started', startedAt, answerDeadline },
    });
    if (count === 0) throw new ConflictException({ code: 'ALREADY_STARTED', message: 'The question was already opened. There is one attempt.' });
    await this.audit.record({ action: 'surprise.started', targetType: 'surprise_question', targetId: surpriseId, candidateId: row.candidateId, actorRole: role });
    return this.toDto({ ...row, status: 'started', startedAt, answerDeadline }, role);
  }

  /**
   * Keeps the video and answers at once; the audio is cut out, transcribed and
   * deleted afterwards, and `status` goes `transcribing → answered` (or `failed`).
   */
  async answer(surpriseId: string, video: UploadedVideo | undefined, consents: AnswerConsents, role: ApiRole): Promise<SurpriseQuestionDto> {
    if (consents.consentVideo !== 'true' || consents.consentProcessing !== 'true') {
      throw new BadRequestException({ code: 'CONSENT_REQUIRED', message: 'Both consents are required: to the video and to processing the answer.' });
    }
    const extension = this.extension(video);
    const row = await this.find(surpriseId);
    const status = surpriseStatus(row);
    if (status === 'ready') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'The question has not been opened yet.', details: { fields: ['status'] } });
    }
    if (status === 'expired') {
      await this.prisma.surpriseQuestion.updateMany({ where: { id: surpriseId, status: 'started' }, data: { status: 'expired' } });
      throw new ConflictException({ code: 'DEADLINE_PASSED', message: 'The time for the answer is over.' });
    }
    if (status !== 'started') this.answered();

    const videoRef = await this.media.saveVideo(surpriseId, extension, (video as UploadedVideo).buffer);
    const { count } = await this.prisma.surpriseQuestion.updateMany({
      where: { id: surpriseId, status: 'started' },
      data: { status: 'transcribing', videoRef },
    });
    if (count === 0) {
      await this.media.delete(videoRef);
      this.answered();
    }
    void this.transcribe(surpriseId, row.candidateId, videoRef);
    return this.toDto({ ...row, status: 'transcribing', videoRef }, role);
  }

  async get(surpriseId: string, role: ApiRole): Promise<SurpriseQuestionDto> {
    return this.toDto(await this.find(surpriseId), role);
  }

  /** Staff only, and every view is written to the audit log; `range` is the player's `Range` header. */
  async video(surpriseId: string, role: ApiRole, range?: string): Promise<VideoFile> {
    if (role === 'platform') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This role does not see the video.' });
    const row = await this.find(surpriseId);
    if (!row.videoRef) throw new NotFoundException({ code: 'NOT_FOUND', message: 'There is no video for this question.' });
    const file = await this.media.open(row.videoRef);
    if (countsAsView(range, file.size)) {
      await this.audit.record({
        action: 'surprise.video.viewed', targetType: 'surprise_question', targetId: surpriseId, candidateId: row.candidateId, actorRole: role,
      });
    }
    return file;
  }

  private async transcribe(surpriseId: string, candidateId: string, videoRef: string): Promise<void> {
    let audioRef: string | undefined;
    try {
      audioRef = await this.media.extractAudio(videoRef);
      const result = await this.gateway.transcribeSurprise(audioRef);
      const segments: SurpriseSegmentDto[] = result.turns
        .filter((turn) => turn.speaker === 'candidate' && turn.text.trim())
        .map((turn, index) => ({
          segmentId: `sseg_${String(index + 1).padStart(2, '0')}`, text: turn.text.trim(), startSec: turn.startSec, endSec: turn.endSec,
        }));
      await this.prisma.surpriseQuestion.update({
        where: { id: surpriseId },
        data: { status: 'answered', segments: segments as unknown as Prisma.InputJsonValue },
      });
      await this.audit.record({ action: 'surprise.answered', targetType: 'surprise_question', targetId: surpriseId, candidateId });
      // A new brief, so its quotes can cite the answer. It never throws.
      await this.briefs.startFor(candidateId);
    } catch (error) {
      this.logger.error(`Surprise answer ${surpriseId} was not transcribed: ${error instanceof Error ? error.message : String(error)}`);
      await this.prisma.surpriseQuestion.update({ where: { id: surpriseId }, data: { status: 'failed' } }).catch(() => undefined);
    } finally {
      // The audio exists only to be transcribed.
      if (audioRef) await this.media.delete(audioRef).catch(() => undefined);
    }
  }

  private extension(video: UploadedVideo | undefined): VideoExtension {
    const found = videoContainer(video?.buffer);
    if (!found) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A webm or mp4 video is required.', details: { fields: ['video'] } });
    return found;
  }

  private async find(surpriseId: string): Promise<SurpriseQuestion> {
    const row = await this.prisma.surpriseQuestion.findUnique({ where: { id: surpriseId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Surprise question was not found.' });
    return row;
  }

  private exists(surpriseId: string): never {
    throw new ConflictException({ code: 'SURPRISE_EXISTS', message: 'This candidate already has the question.', details: { surpriseId } });
  }

  private answered(): never {
    throw new ConflictException({ code: 'ALREADY_ANSWERED', message: 'The answer is already recorded.' });
  }

  /** `question` stays hidden until `start`, for every role; the staff fields never reach `platform`. */
  private toDto(row: SurpriseQuestion, role: ApiRole): SurpriseQuestionDto {
    const status = surpriseStatus(row);
    const dto: SurpriseQuestionDto = {
      surpriseId: row.id,
      candidateId: row.candidateId,
      status,
      question: status === 'ready' ? null : row.question,
      answerSeconds: row.answerSeconds,
      startedAt: row.startedAt?.toISOString() ?? null,
      answerDeadline: row.answerDeadline?.toISOString() ?? null,
    };
    if (role === 'platform') return dto;
    return {
      ...dto,
      competency: row.competency as SurpriseQuestionDto['competency'],
      why: row.why,
      segments: (row.segments as unknown as SurpriseSegmentDto[] | null) ?? null,
      videoAvailable: Boolean(row.videoRef),
    };
  }
}
