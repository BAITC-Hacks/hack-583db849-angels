import { Module } from '@nestjs/common';
import { SimulationsController } from './simulations.controller';

@Module({ controllers: [SimulationsController] })
export class SimulationsModule {}
