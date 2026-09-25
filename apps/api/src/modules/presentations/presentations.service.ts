import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException, StreamableFile,
} from '@nestjs/common';
import { Presentation, Prisma } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import { ApiRole } from '../../auth/roles';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BriefsService } from '../briefs/briefs.service';
import { SurpriseMediaService, videoContainer } from '../surprise/surprise-media.service';
import {
  PRESENTATION_MAX_SECONDS, PRESENTATION_MIN_SECONDS, PRESENTATION_PROMPT, PresentationDto, PresentationSegmentDto,
} from './presentation.dto';

export interface UploadedVideo {
  buffer: Buffer;
  size: number;
}

export interface PresentationFields {
  candidateId?: unknown;
  consentVideo?: unknown;
  consentProcessing?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PresentationsService {
  private readonly logger = new Logger(PresentationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly media: SurpriseMediaService,
    private readonly briefs: BriefsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The presentation, sent once. It answers at once with `transcribing`; the
   * audio is cut out, transcribed and deleted, and a new brief is made.
   */
  async submit(fields: PresentationFields, video: UploadedVideo | undefined, role: ApiRole): Promise<PresentationDto> {
    if (fields.consentVideo !== 'true' || fields.consentProcessing !== 'true') {
      throw new BadRequestException({ code: 'CONSENT_REQUIRED', message: 'Both consents are required: to the video and to processing it.' });
    }
    const candidateId = typeof fields.candidateId === 'string' && UUID.test(fields.candidateId) ? fields.candidateId : null;
    if (!candidateId) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'candidateId must be a UUID.', details: { fields: ['candidateId'] } });
    const extension = videoContainer(video?.buffer);
    if (!video || !extension) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A webm or mp4 video is required.', details: { fields: ['video'] } });

    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { id: true, presentation: { select: { id: true } } } });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    if (candidate.presentation) this.exists(candidate.presentation.id);

    const videoRef = await this.media.saveVideo(candidateId, extension, video.buffer, 'presentations');
    let row: Presentation;
    try {
      const durationSec = await this.media.durationSeconds(videoRef);
      if (durationSec === null) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'The video could not be read.', details: { fields: ['video'] } });
      }
      if (durationSec < PRESENTATION_MIN_SECONDS) {
        throw new BadRequestException({ code: 'VIDEO_TOO_SHORT', message: 'A presentation is at least one minute long.', details: { durationSec } });
      }
      if (durationSec > PRESENTATION_MAX_SECONDS + 5) {
        throw new HttpException({ code: 'PAYLOAD_TOO_LARGE', message: 'A presentation is at most three minutes long.', details: { durationSec } }, HttpStatus.PAYLOAD_TOO_LARGE);
      }
      row = await this.prisma.presentation.create({ data: { candidateId, durationSec, videoRef } });
    } catch (error) {
      await this.media.delete(videoRef);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.presentation.findUnique({ where: { candidateId }, select: { id: true } });
        if (winner) this.exists(winner.id);
      }
      throw error;
    }

    await this.audit.record({ action: 'presentation.submitted', targetType: 'presentation', targetId: row.id, candidateId, actorRole: role });
    void this.transcribe(row.id, candidateId, videoRef);
    return this.toDto(row, role);
  }

  async get(presentationId: string, role: ApiRole): Promise<PresentationDto> {
    return this.toDto(await this.find(presentationId), role);
  }

  /** Staff only, and every view is written to the audit log. */
  async video(presentationId: string, role: ApiRole): Promise<StreamableFile> {
    if (role === 'platform') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This role does not see the video.' });
    const row = await this.find(presentationId);
    if (!row.videoRef) throw new NotFoundException({ code: 'NOT_FOUND', message: 'There is no video for this presentation.' });
    const file = await this.media.open(row.videoRef);
    await this.audit.record({ action: 'presentation.video.viewed', targetType: 'presentation', targetId: presentationId, candidateId: row.candidateId, actorRole: role });
    return new StreamableFile(file.stream, { type: file.type, length: file.length });
  }

  private async transcribe(presentationId: string, candidateId: string, videoRef: string): Promise<void> {
    let audioRef: string | undefined;
    try {
      audioRef = await this.media.extractAudio(videoRef);
      // One speaker, like the surprise answer; `purpose: "presentation"` once the ML service has it (ml.md, rule 6d).
      const result = await this.gateway.transcribeSurprise(audioRef);
      const segments: PresentationSegmentDto[] = result.turns
        .filter((turn) => turn.speaker === 'candidate' && turn.text.trim())
        .map((turn, index) => ({
          segmentId: `pseg_${String(index + 1).padStart(2, '0')}`, text: turn.text.trim(), startSec: turn.startSec, endSec: turn.endSec,
        }));
      await this.prisma.presentation.update({
        where: { id: presentationId },
        data: { status: 'ready', segments: segments as unknown as Prisma.InputJsonValue },
      });
      // A new brief, with the presentation beside it. It never throws.
      await this.briefs.startFor(candidateId);
    } catch (error) {
      this.logger.error(`Presentation ${presentationId} was not transcribed: ${error instanceof Error ? error.message : String(error)}`);
      await this.prisma.presentation.update({ where: { id: presentationId }, data: { status: 'failed' } }).catch(() => undefined);
    } finally {
      // The audio exists only to be transcribed.
      if (audioRef) await this.media.delete(audioRef).catch(() => undefined);
    }
  }

  private async find(presentationId: string): Promise<Presentation> {
    const row = await this.prisma.presentation.findUnique({ where: { id: presentationId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Presentation was not found.' });
    return row;
  }

  private exists(presentationId: string): never {
    throw new ConflictException({ code: 'PRESENTATION_EXISTS', message: 'This candidate has already sent a presentation.', details: { presentationId } });
  }

  /** The candidate's channel sees the status, never the transcript or the video. */
  private toDto(row: Presentation, role: ApiRole): PresentationDto {
    const dto: PresentationDto = {
      presentationId: row.id,
      candidateId: row.candidateId,
      status: row.status as PresentationDto['status'],
      prompt: PRESENTATION_PROMPT,
      durationSec: Math.round(row.durationSec),
      submittedAt: row.createdAt.toISOString(),
    };
    if (role === 'platform') return dto;
    return { ...dto, segments: (row.segments as unknown as PresentationSegmentDto[] | null) ?? null, videoAvailable: Boolean(row.videoRef) };
  }
}
