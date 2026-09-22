import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ApiKeyGuard } from './api-key.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ApiKeyGuard, RolesGuard],
  exports: [ApiKeyGuard, RolesGuard],
})
export class AuthModule {}
