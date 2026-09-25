import { createHash } from 'node:crypto';

import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiConsumes, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';

import { ApiRole } from '../../auth/roles';
import { Roles } from '../../auth/roles.decorator';
import { sendVideo } from '../../media/video-range';
import { EntityId } from '../../entity-id.pipe';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { CreateSurpriseDto, SurpriseAnswerDto, SurpriseQuestionDto } from './dto/surprise.dto';
import { AnswerConsents, SurpriseService, UploadedVideo } from './surprise.service';

type RoleRequest = Request & { apiRole: ApiRole };

/**
 * S. The candidate's channel (`platform`) creates, opens and answers the
 * question; interviewer and commission read it and watch the video; admin
 * can do everything. The one attempt is held here, not on the screen.
 */
@ApiTags('surprise-questions')
@Controller('surprise-questions')
export class SurpriseController {
  constructor(private readonly surprise: SurpriseService, private readonly idempotency: IdempotencyService) {}

  @Post()
  @Roles('platform', 'admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: SurpriseQuestionDto })
  create(@Body() input: CreateSurpriseDto, @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<SurpriseQuestionDto> {
    return this.idempotency.execute(key, { operation: 'surprise.create', candidateId: input.candidateId },
      () => this.surprise.create(input.candidateId, request.apiRole));
  }

  @Post(':surpriseId/start')
  @HttpCode(200)
  @Roles('platform', 'admin')
  @ApiParam({ name: 'surpriseId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOkResponse({ type: SurpriseQuestionDto })
  start(@Param('surpriseId', EntityId) surpriseId: string, @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<SurpriseQuestionDto> {
    return this.idempotency.execute(key, { operation: 'surprise.start', surpriseId },
      () => this.surprise.start(surpriseId, request.apiRole), 200);
  }

  @Post(':surpriseId/answer')
  @HttpCode(202)
  @Roles('platform', 'admin')
  @ApiParam({ name: 'surpriseId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SurpriseAnswerDto })
  @ApiAcceptedResponse({ type: SurpriseQuestionDto })
  @UseInterceptors(FileInterceptor('video', { limits: { fileSize: 50 * 1024 * 1024 } }))
  answer(@Param('surpriseId', EntityId) surpriseId: string, @UploadedFile() video: UploadedVideo | undefined,
    @Body() consents: AnswerConsents, @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<SurpriseQuestionDto> {
    const videoDigest = video ? createHash('sha256').update(video.buffer).digest('hex') : null;
    return this.idempotency.execute(key, { operation: 'surprise.answer', surpriseId, videoDigest },
      () => this.surprise.answer(surpriseId, video, consents ?? {}, request.apiRole), 202);
  }

  @Get(':surpriseId')
  @Roles('platform', 'interviewer', 'commission', 'admin')
  @ApiParam({ name: 'surpriseId', type: String })
  @ApiOkResponse({ type: SurpriseQuestionDto })
  get(@Param('surpriseId', EntityId) surpriseId: string, @Req() request: RoleRequest): Promise<SurpriseQuestionDto> {
    return this.surprise.get(surpriseId, request.apiRole);
  }

  @Get(':surpriseId/video')
  @Roles('interviewer', 'commission', 'admin')
  @ApiParam({ name: 'surpriseId', type: String })
  @ApiOkResponse({ content: { 'video/webm': { schema: { type: 'string', format: 'binary' } }, 'video/mp4': { schema: { type: 'string', format: 'binary' } } } })
  async video(@Param('surpriseId', EntityId) surpriseId: string, @Req() request: RoleRequest, @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    return sendVideo(response, await this.surprise.video(surpriseId, request.apiRole, range), range);
  }
}
