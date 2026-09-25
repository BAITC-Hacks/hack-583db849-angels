import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/roles.decorator';
import { EntityId } from '../../entity-id.pipe';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { CandidateFeedbackDto, CreateSimulationAssessmentDto, SimulationAssessmentDto } from './dto/simulation-assessment.dto';
import { SimulationAssessmentsService } from './simulation-assessments.service';

@ApiTags('simulation-assessments')
@Controller('simulation-assessments')
export class SimulationAssessmentsController {
  constructor(private readonly idempotency: IdempotencyService, private readonly assessments: SimulationAssessmentsService) {}

  @Post()
  @Roles('admin')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: SimulationAssessmentDto })
  create(@Body() input: CreateSimulationAssessmentDto, @Headers('idempotency-key') key: string | undefined): Promise<SimulationAssessmentDto> {
    return this.idempotency.execute(key, { operation: 'simulation-assessment.create', simulationId: input.simulationId },
      () => this.assessments.rerun(input.simulationId));
  }

  @Get(':assessmentId')
  @Roles('commission', 'admin')
  @ApiParam({ name: 'assessmentId', type: String })
  @ApiOkResponse({ type: SimulationAssessmentDto })
  get(@Param('assessmentId', EntityId) assessmentId: string): Promise<SimulationAssessmentDto> {
    return this.assessments.get(assessmentId);
  }

  @Get(':assessmentId/candidate-feedback')
  @Roles('platform', 'interviewer', 'commission', 'admin')
  @ApiParam({ name: 'assessmentId', type: String })
  @ApiOkResponse({ type: CandidateFeedbackDto })
  feedback(@Param('assessmentId', EntityId) assessmentId: string): Promise<CandidateFeedbackDto> {
    return this.assessments.feedback(assessmentId);
  }
}
