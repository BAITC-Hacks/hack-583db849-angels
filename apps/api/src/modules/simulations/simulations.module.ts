import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AudioStorageService } from './audio-storage.service';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';

@Module({ imports: [ConfigModule], controllers: [SimulationsController], providers: [AudioStorageService, SimulationsService], exports: [SimulationsService] })
export class SimulationsModule {}
