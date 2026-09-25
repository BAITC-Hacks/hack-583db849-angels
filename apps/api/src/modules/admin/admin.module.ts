import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [ConfigModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
