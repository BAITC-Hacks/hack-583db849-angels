import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SurpriseModule } from '../surprise/surprise.module';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';

@Module({ imports: [ConfigModule, SurpriseModule], controllers: [RetentionController], providers: [RetentionService], exports: [RetentionService] })
export class RetentionModule {}
