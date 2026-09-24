import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { DemoSeedService } from './demo-seed.service';
import { SimulationsModule } from '../simulations/simulations.module';

@Module({ imports: [ConfigModule, SimulationsModule], controllers: [CandidatesController], providers: [CandidatesService, DemoSeedService] })
export class CandidatesModule {}
