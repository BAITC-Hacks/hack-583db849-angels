import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { InterviewAudioService } from './interview-audio.service';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({ imports: [ConfigModule], controllers: [InterviewsController, FollowUpsController], providers: [InterviewAudioService, InterviewsService, FollowUpsService], exports: [InterviewsService] })
export class InterviewsModule {}
