import { createHash } from 'node:crypto';

import { Body, Controller, Get, Headers, Param, Post, Put, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { ApiRole } from '../../auth/roles';
import { Roles } from '../../auth/roles.decorator';
import { EntityId } from '../../entity-id.pipe';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { FollowUpDto, FollowUpListDto, FollowUpUploadDto, MarkSuggestionDto } from './dto/follow-up.dto';
import { FollowUpsService } from './follow-ups.service';
import { UploadedAudio } from './interviews.service';

type RoleRequest = Request & { apiRole: ApiRole };

@ApiTags('interviews')
@Controller('interviews/:interviewId/follow-ups')
@ApiParam({ name: 'interviewId', type: String })
export class FollowUpsController {
  constructor(private readonly followUps: FollowUpsService, private readonly idempotency: IdempotencyService) {}

  @Post()
  @Roles('interviewer', 'admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FollowUpUploadDto })
  @ApiCreatedResponse({ type: FollowUpDto })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 5 * 1024 * 1024 } }))
  create(@Param('interviewId', EntityId) interviewId: string, @UploadedFile() audio: UploadedAudio | undefined,
    @Body() body: Record<string, unknown>, @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<FollowUpDto> {
    const digest = audio ? createHash('sha256').update(audio.buffer).digest('hex') : null;
    return this.idempotency.execute(key, { operation: 'interview.follow-up', interviewId, digest, question: body?.question, sample: body?.sample },
      () => this.followUps.create(interviewId, audio, body?.question, body?.sample === 'true', request.apiRole));
  }

  @Get()
  @Roles('interviewer', 'commission', 'admin')
  @ApiOkResponse({ type: FollowUpListDto })
  list(@Param('interviewId', EntityId) interviewId: string): Promise<FollowUpListDto> {
    return this.followUps.list(interviewId);
  }

  @Put(':followUpId/suggestions/:suggestionId')
  @Roles('interviewer', 'admin')
  @ApiParam({ name: 'followUpId', type: String })
  @ApiParam({ name: 'suggestionId', type: String })
  @ApiOkResponse({ type: FollowUpDto })
  mark(@Param('interviewId', EntityId) interviewId: string, @Param('followUpId', EntityId) followUpId: string,
    @Param('suggestionId') suggestionId: string, @Body() body: MarkSuggestionDto, @Req() request: RoleRequest): Promise<FollowUpDto> {
    return this.followUps.mark(interviewId, followUpId, suggestionId, body.status, request.apiRole);
  }
}
