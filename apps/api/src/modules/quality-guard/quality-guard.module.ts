import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { QualityGuardController } from './quality-guard.controller';
import { QualityGuardService } from './quality-guard.service';

@Module({ imports: [ConfigModule], controllers: [QualityGuardController], providers: [QualityGuardService] })
export class QualityGuardModule {}
