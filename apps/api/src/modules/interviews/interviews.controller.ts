import { createHash } from 'node:crypto';

import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiConsumes, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { ApiRole } from '../../auth/roles';
import { Roles } from '../../auth/roles.decorator';
import { EntityId } from '../../entity-id.pipe';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import {
  AssessmentDraftDto, CreateInterviewDto, InterviewDto, InterviewerScoresSavedDto, InterviewRecordingDto, SaveInterviewerScoresDto,
} from './dto/interview.dto';
import { InterviewsService, UploadedAudio } from './interviews.service';

type RoleRequest = Request & { apiRole: ApiRole };

/**
 * M4. The interviewer records and scores; the commission reads. The draft is
 * locked for everyone until the interviewer's own scores are saved — the
 * server holds that, not the screen.
 */
@ApiTags('interviews')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService, private readonly idempotency: IdempotencyService) {}

  @Post()
  @Roles('interviewer', 'admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: InterviewDto })
  create(@Body() input: CreateInterviewDto, @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<InterviewDto> {
    return this.idempotency.execute(key, { operation: 'interview.create', ...input }, () => this.interviews.create(input, request.apiRole));
  }

  @Post(':interviewId/recording')
  @HttpCode(202)
  @Roles('interviewer', 'admin')
  @ApiParam({ name: 'interviewId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: InterviewRecordingDto })
  @ApiAcceptedResponse({ type: InterviewDto })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 200 * 1024 * 1024 } }))
  recording(@Param('interviewId', EntityId) interviewId: string, @UploadedFile() audio: UploadedAudio | undefined,
    @Body() body: Record<string, unknown>, @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<InterviewDto> {
    const audioDigest = audio ? createHash('sha256').update(audio.buffer).digest('hex') : null;
    return this.idempotency.execute(key, { operation: 'interview.recording', interviewId, audioDigest },
      () => this.interviews.recording(interviewId, audio, body?.consent, request.apiRole), 202);
  }

  @Get(':interviewId')
  @Roles('interviewer', 'commission', 'admin')
  @ApiParam({ name: 'interviewId', type: String })
  @ApiOkResponse({ type: InterviewDto })
  get(@Param('interviewId', EntityId) interviewId: string): Promise<InterviewDto> {
    return this.interviews.get(interviewId);
  }

  @Post(':interviewId/interviewer-scores')
  @Roles('interviewer', 'admin')
  @ApiParam({ name: 'interviewId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: InterviewerScoresSavedDto })
  scores(@Param('interviewId', EntityId) interviewId: string, @Body() input: SaveInterviewerScoresDto,
    @Headers('idempotency-key') key: string | undefined, @Req() request: RoleRequest): Promise<InterviewerScoresSavedDto> {
    return this.idempotency.execute(key, { operation: 'interview.scores', interviewId, scores: input.scores },
      () => this.interviews.saveScores(interviewId, input.scores, request.apiRole));
  }

  @Post(':interviewId/assessment-draft')
  @Roles('interviewer', 'admin')
  @ApiParam({ name: 'interviewId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: AssessmentDraftDto })
  createDraft(@Param('interviewId', EntityId) interviewId: string, @Headers('idempotency-key') key: string | undefined): Promise<AssessmentDraftDto> {
    return this.idempotency.execute(key, { operation: 'interview.draft', interviewId }, () => this.interviews.createDraft(interviewId));
  }

  @Get(':interviewId/assessment-draft')
  @Roles('interviewer', 'commission', 'admin')
  @ApiParam({ name: 'interviewId', type: String })
  @ApiOkResponse({ type: AssessmentDraftDto })
  draft(@Param('interviewId', EntityId) interviewId: string): Promise<AssessmentDraftDto> {
    return this.interviews.getDraft(interviewId);
  }
}
