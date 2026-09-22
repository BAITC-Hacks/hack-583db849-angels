import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [AuthModule, DatabaseModule, IdempotencyModule, PrivacyModule, AuditModule, CandidatesModule],
  controllers: [HealthController],
})
export class AppModule {}
