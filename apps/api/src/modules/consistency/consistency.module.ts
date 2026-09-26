import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ConsistencyController } from './consistency.controller';
import { ConsistencyService } from './consistency.service';

@Global()
@Module({ imports: [ConfigModule], controllers: [ConsistencyController], providers: [ConsistencyService], exports: [ConsistencyService] })
export class ConsistencyModule {}
