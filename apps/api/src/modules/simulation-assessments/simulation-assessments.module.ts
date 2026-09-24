import { Module } from '@nestjs/common';

import { SimulationAssessmentsController } from './simulation-assessments.controller';

@Module({ controllers: [SimulationAssessmentsController] })
export class SimulationAssessmentsModule {}
