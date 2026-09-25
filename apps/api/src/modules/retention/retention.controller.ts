import { Body, Controller, Param, Put, Req } from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { ApiRole } from '../../auth/roles';
import { Roles } from '../../auth/roles.decorator';
import { EntityId } from '../../entity-id.pipe';
import { DecisionDateDto, DecisionDateInputDto } from './decision-date.dto';
import { RetentionService } from './retention.service';

/**
 * inVision's platform tells the API when the commission decided, so the
 * candidate's videos can be deleted on time. Commission and admin may set it
 * too, for the demo. The outcome of the decision is never sent here.
 */
@ApiTags('candidates')
@Controller('candidates')
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Put(':candidateId/decision-date')
  @Roles('platform', 'commission', 'admin')
  @ApiParam({ name: 'candidateId', type: String })
  @ApiOkResponse({ type: DecisionDateDto })
  decisionDate(@Param('candidateId', EntityId) candidateId: string, @Body() input: DecisionDateInputDto,
    @Req() request: Request & { apiRole: ApiRole }): Promise<DecisionDateDto> {
    return this.retention.setDecisionDate(candidateId, input.decidedAt, request.apiRole);
  }
}
