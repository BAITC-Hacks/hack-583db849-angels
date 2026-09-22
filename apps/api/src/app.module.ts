import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { IdempotencyModule } from './idempotency/idempotency.module';

@Module({
  imports: [AuthModule, DatabaseModule, IdempotencyModule, CandidatesModule],
  controllers: [HealthController],
})
export class AppModule {}
