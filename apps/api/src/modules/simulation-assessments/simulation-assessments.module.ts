import { Global, Module } from '@nestjs/common';

import { SimulationAssessmentsController } from './simulation-assessments.controller';
import { SimulationAssessmentsService } from './simulation-assessments.service';

@Global()
@Module({ controllers: [SimulationAssessmentsController], providers: [SimulationAssessmentsService], exports: [SimulationAssessmentsService] })
export class SimulationAssessmentsModule {}
