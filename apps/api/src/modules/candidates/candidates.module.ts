import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { DemoSeedService } from './demo-seed.service';

@Module({ imports: [ConfigModule], controllers: [CandidatesController], providers: [CandidatesService, DemoSeedService] })
export class CandidatesModule {}
