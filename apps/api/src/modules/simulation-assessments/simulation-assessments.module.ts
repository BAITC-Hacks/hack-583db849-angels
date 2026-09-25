import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SimulationAssessmentsController } from './simulation-assessments.controller';
import { SimulationAssessmentsService } from './simulation-assessments.service';

@Global()
@Module({ imports: [ConfigModule], controllers: [SimulationAssessmentsController], providers: [SimulationAssessmentsService], exports: [SimulationAssessmentsService] })
export class SimulationAssessmentsModule {}
