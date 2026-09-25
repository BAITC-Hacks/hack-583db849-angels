import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/roles.decorator';
import { EntityId } from '../../entity-id.pipe';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { BriefsService } from './briefs.service';
import { BriefDto, CreateBriefDto } from './dto/brief.dto';

/**
 * M1. The brief is for the people who interview: `platform`, the candidate's
 * channel, never reads one. The API makes briefs by itself; POST is the
 * admin's re-run.
 */
@ApiTags('briefs')
@Controller()
export class BriefsController {
  constructor(private readonly idempotency: IdempotencyService, private readonly briefs: BriefsService) {}

  @Post('briefs')
  @Roles('admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: BriefDto })
  create(@Body() input: CreateBriefDto, @Headers('idempotency-key') key: string | undefined): Promise<BriefDto> {
    return this.idempotency.execute(key, { operation: 'brief.create', candidateId: input.candidateId }, () =>
      this.briefs.rerun(input.candidateId),
    );
  }

  @Get('briefs/:briefId')
  @Roles('interviewer', 'commission', 'admin')
  @ApiParam({ name: 'briefId', type: String })
  @ApiOkResponse({ type: BriefDto })
  get(@Param('briefId', EntityId) briefId: string): Promise<BriefDto> {
    return this.briefs.get(briefId);
  }

  @Get('candidates/:candidateId/brief')
  @Roles('interviewer', 'commission', 'admin')
  @ApiParam({ name: 'candidateId', type: String })
  @ApiOkResponse({ type: BriefDto })
  latest(@Param('candidateId', EntityId) candidateId: string): Promise<BriefDto> {
    return this.briefs.latestFor(candidateId);
  }
}
