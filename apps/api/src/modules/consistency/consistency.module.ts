import { Global, Module } from '@nestjs/common';

import { ConsistencyController } from './consistency.controller';
import { ConsistencyService } from './consistency.service';

@Global()
@Module({ controllers: [ConsistencyController], providers: [ConsistencyService], exports: [ConsistencyService] })
export class ConsistencyModule {}
