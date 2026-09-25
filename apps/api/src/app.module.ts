import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiClientModule } from './ai-client/ai-client.module';
import { BriefsModule } from './modules/briefs/briefs.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { QualityGuardModule } from './modules/quality-guard/quality-guard.module';
import { SimulationAssessmentsModule } from './modules/simulation-assessments/simulation-assessments.module';
import { SimulationsModule } from './modules/simulations/simulations.module';
import { ScenariosModule } from './modules/scenarios/scenarios.module';
import { SurpriseModule } from './modules/surprise/surprise.module';
import { ConsistencyModule } from './modules/consistency/consistency.module';
import { ApiExceptionFilter } from './api-exception.filter';

@Module({
  imports: [AuthModule, DatabaseModule, IdempotencyModule, PrivacyModule, AiClientModule, AuditModule, CandidatesModule, ScenariosModule, BriefsModule, SimulationsModule, SimulationAssessmentsModule, InterviewsModule, QualityGuardModule, SurpriseModule, ConsistencyModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
