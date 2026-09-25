import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SurpriseMediaService } from './surprise-media.service';
import { SurpriseController } from './surprise.controller';
import { SurpriseService } from './surprise.service';

@Module({ imports: [ConfigModule], controllers: [SurpriseController], providers: [SurpriseMediaService, SurpriseService] })
export class SurpriseModule {}
