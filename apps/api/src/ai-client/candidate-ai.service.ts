import { Inject, Injectable } from '@nestjs/common';

import { AI_GATEWAY, AiGateway } from './ai-gateway.port';
import { CandidateSnapshot, ToLlmViewService } from '../privacy/to-llm-view.service';

@Injectable()
export class CandidateAiService {
  constructor(
    private readonly privacy: ToLlmViewService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
  ) {}

  sendCandidateContext(candidateId: string, snapshot: CandidateSnapshot): Promise<void> {
    return this.gateway.sendCandidateContext(this.privacy.toLlmView(candidateId, snapshot));
  }
}
