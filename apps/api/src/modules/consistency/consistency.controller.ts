import { Controller, ForbiddenException, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { ApiRole } from '../../auth/roles';
import { Roles } from '../../auth/roles.decorator';
import { EntityId } from '../../entity-id.pipe';
import { ConsistencyService } from './consistency.service';
import { ConsistencyQueryDto, ConsistencyReportDto } from './dto/consistency.dto';

/**
 * C. The before stage is for everyone who interviews or decides; the after
 * stage only for the commission and the admin — the interviewer reads the
 * brief, not a verdict on their own interview. The candidate's channel sees
 * neither.
 */
@ApiTags('consistency')
@Controller('candidates')
export class ConsistencyController {
  constructor(private readonly consistency: ConsistencyService) {}

  @Get(':candidateId/consistency')
  @Roles('interviewer', 'commission', 'admin')
  @ApiParam({ name: 'candidateId', type: String })
  @ApiOkResponse({ type: ConsistencyReportDto })
  get(@Param('candidateId', EntityId) candidateId: string, @Query() { stage }: ConsistencyQueryDto,
    @Req() request: Request & { apiRole: ApiRole }): Promise<ConsistencyReportDto> {
    if (stage === 'after' && request.apiRole === 'interviewer') {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'The after stage is for the commission.' });
    }
    return stage === 'before' ? this.consistency.before(candidateId) : this.consistency.after(candidateId);
  }
}
