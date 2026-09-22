import { Global, Module } from '@nestjs/common';

import { AI_GATEWAY } from './ai-gateway.port';
import { CandidateAiService } from './candidate-ai.service';
import { UnavailableAiGateway } from './unavailable-ai-gateway';

@Global()
@Module({
  providers: [CandidateAiService, UnavailableAiGateway, { provide: AI_GATEWAY, useExisting: UnavailableAiGateway }],
  exports: [CandidateAiService, AI_GATEWAY],
})
export class AiClientModule {}
