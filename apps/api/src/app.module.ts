import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [HealthController],
})
export class AppModule {}
