import { createHash } from 'node:crypto';

import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiConsumes, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';

import { ApiRole } from '../../auth/roles';
import { Roles } from '../../auth/roles.decorator';
import { sendVideo } from '../../media/video-range';
import { EntityId } from '../../entity-id.pipe';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { PresentationDto, SubmitPresentationDto } from './presentation.dto';
import { PresentationFields, PresentationsService, UploadedVideo } from './presentations.service';

type RoleRequest = Request & { apiRole: ApiRole };

/** P. The candidate's channel sends the presentation; staff read the transcript and watch the video. */
@ApiTags('presentations')
@Controller('presentations')
export class PresentationsController {
  constructor(private readonly presentations: PresentationsService, private readonly idempotency: IdempotencyService) {}

  @Post()
  @HttpCode(202)
  @Roles('platform', 'admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SubmitPresentationDto })
  @ApiAcceptedResponse({ type: PresentationDto })
  @UseInterceptors(FileInterceptor('video', { limits: { fileSize: 100 * 1024 * 1024 } }))
  submit(@UploadedFile() video: UploadedVideo | undefined, @Body() fields: PresentationFields,
    @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<PresentationDto> {
    const videoDigest = video ? createHash('sha256').update(video.buffer).digest('hex') : null;
    return this.idempotency.execute(key, { operation: 'presentation.submit', candidateId: fields?.candidateId ?? null, videoDigest },
      () => this.presentations.submit(fields ?? {}, video, request.apiRole), 202);
  }

  @Get(':presentationId')
  @Roles('platform', 'interviewer', 'commission', 'admin')
  @ApiParam({ name: 'presentationId', type: String })
  @ApiOkResponse({ type: PresentationDto })
  get(@Param('presentationId', EntityId) presentationId: string, @Req() request: RoleRequest): Promise<PresentationDto> {
    return this.presentations.get(presentationId, request.apiRole);
  }

  @Get(':presentationId/video')
  @Roles('interviewer', 'commission', 'admin')
  @ApiParam({ name: 'presentationId', type: String })
  @ApiOkResponse({ content: { 'video/webm': { schema: { type: 'string', format: 'binary' } }, 'video/mp4': { schema: { type: 'string', format: 'binary' } } } })
  async video(@Param('presentationId', EntityId) presentationId: string, @Req() request: RoleRequest, @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    return sendVideo(response, await this.presentations.video(presentationId, request.apiRole, range), range);
  }
}
