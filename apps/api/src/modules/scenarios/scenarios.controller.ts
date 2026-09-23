import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/roles.decorator';
import { ScenarioSummaryDto } from './dto/scenario-summary.dto';
import { ScenariosService } from './scenarios.service';

@ApiTags('scenarios')
@Controller('scenarios')
@Roles('interviewer', 'commission', 'admin')
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  @ApiOkResponse({ type: [ScenarioSummaryDto] })
  list(): Promise<ScenarioSummaryDto[]> {
    return this.scenarios.list();
  }
}
