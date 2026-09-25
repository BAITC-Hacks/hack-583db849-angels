import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/roles.decorator';
import { contractExample } from '../../contract-example';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { CandidateFeedbackDto, CreateSimulationAssessmentDto, SimulationAssessmentDto } from './dto/simulation-assessment.dto';

@ApiTags('simulation-assessments')
@Controller('simulation-assessments')
export class SimulationAssessmentsController {
  constructor(private readonly idempotency: IdempotencyService) {}

  @Post()
  @Roles('admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: SimulationAssessmentDto })
  create(@Body() input: CreateSimulationAssessmentDto, @Headers('idempotency-key') key: string | undefined): Promise<SimulationAssessmentDto> {
    return this.idempotency.execute(key, { operation: 'simulation-assessment.create', simulationId: input.simulationId },
      async () => contractExample<SimulationAssessmentDto>('assessment.json'));
  }

  @Get(':assessmentId')
  @Roles('commission', 'admin')
  @ApiParam({ name: 'assessmentId', type: String })
  @ApiOkResponse({ type: SimulationAssessmentDto })
  get(): SimulationAssessmentDto {
    return contractExample<SimulationAssessmentDto>('assessment.json');
  }

  @Get(':assessmentId/candidate-feedback')
  @Roles('platform', 'interviewer', 'commission', 'admin')
  @ApiParam({ name: 'assessmentId', type: String })
  @ApiOkResponse({ type: CandidateFeedbackDto })
  feedback(): CandidateFeedbackDto {
    return contractExample<CandidateFeedbackDto>('candidate-feedback.json');
  }
}
