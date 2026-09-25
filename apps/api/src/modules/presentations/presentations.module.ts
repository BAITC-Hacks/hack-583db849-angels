import { Module } from '@nestjs/common';

import { SurpriseModule } from '../surprise/surprise.module';
import { PresentationsController } from './presentations.controller';
import { PresentationsService } from './presentations.service';

@Module({ imports: [SurpriseModule], controllers: [PresentationsController], providers: [PresentationsService] })
export class PresentationsModule {}
