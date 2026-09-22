import { Global, Module } from '@nestjs/common';
import { ToLlmViewService } from './to-llm-view.service';
@Global()
@Module({ providers: [ToLlmViewService], exports: [ToLlmViewService] })
export class PrivacyModule {}
