import { Inject, Injectable } from '@nestjs/common';

import { AI_GATEWAY, AiGateway } from './ai-gateway.port';
import type { components } from './schema';
import { CandidateSnapshot, ToLlmViewService } from '../privacy/to-llm-view.service';

@Injectable()
export class CandidateAiService {
  constructor(
    private readonly privacy: ToLlmViewService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
  ) {}

  /** The M1 brief. Only `toLlmView` reaches ML: the answers with the candidate's identifiers redacted, never the profile. */
  brief(
    candidateId: string,
    snapshot: CandidateSnapshot,
    simulationEnglish?: components['schemas']['EnglishMetrics'] | null,
  ): Promise<components['schemas']['BriefResult']> {
    return this.gateway.brief({
      candidate: this.privacy.toLlmView(candidateId, snapshot),
      ...(simulationEnglish ? { simulationEnglish } : {}),
    });
  }

  /** The surprise question, written from the candidate's own answers — again only through `toLlmView`. */
  surpriseQuestion(candidateId: string, snapshot: CandidateSnapshot): Promise<components['schemas']['SurpriseResult']> {
    return this.gateway.surpriseQuestion({ candidate: this.privacy.toLlmView(candidateId, snapshot) });
  }
}
