import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BriefsController } from './briefs.controller';
import { BriefsService } from './briefs.service';

@Global()
@Module({ imports: [ConfigModule], controllers: [BriefsController], providers: [BriefsService], exports: [BriefsService] })
export class BriefsModule {}
