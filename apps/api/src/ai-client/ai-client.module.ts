import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AI_GATEWAY } from './ai-gateway.port';
import { CandidateAiService } from './candidate-ai.service';
import { ML_FETCH, MlHttpAdapter } from './ml-http.adapter';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    CandidateAiService,
    MlHttpAdapter,
    { provide: ML_FETCH, useValue: globalThis.fetch },
    { provide: AI_GATEWAY, useExisting: MlHttpAdapter },
  ],
  exports: [CandidateAiService, AI_GATEWAY],
})
export class AiClientModule {}
