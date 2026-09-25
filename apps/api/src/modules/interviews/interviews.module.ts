import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { InterviewAudioService } from './interview-audio.service';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({ imports: [ConfigModule], controllers: [InterviewsController], providers: [InterviewAudioService, InterviewsService], exports: [InterviewsService] })
export class InterviewsModule {}
