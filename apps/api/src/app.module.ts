import { Module } from '@nestjs/common';

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

@Module({
  imports: [AuthModule, DatabaseModule, IdempotencyModule, PrivacyModule, AiClientModule, AuditModule, CandidatesModule, BriefsModule, SimulationsModule, SimulationAssessmentsModule, InterviewsModule, QualityGuardModule],
  controllers: [HealthController],
})
export class AppModule {}
