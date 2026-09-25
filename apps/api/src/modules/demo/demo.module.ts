import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CandidatesModule } from '../candidates/candidates.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({ imports: [ConfigModule, CandidatesModule], controllers: [DemoController], providers: [DemoService] })
export class DemoModule {}
