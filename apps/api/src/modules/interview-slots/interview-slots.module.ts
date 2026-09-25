import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { InterviewsModule } from '../interviews/interviews.module';
import { InterviewSlotsController } from './interview-slots.controller';
import { InterviewSlotsService } from './interview-slots.service';

@Module({ imports: [ConfigModule, InterviewsModule], controllers: [InterviewSlotsController], providers: [InterviewSlotsService] })
export class InterviewSlotsModule {}
