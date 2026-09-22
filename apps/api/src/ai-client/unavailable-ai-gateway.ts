import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { AiGateway } from './ai-gateway.port';
import { LlmView } from '../privacy/to-llm-view.service';

@Injectable()
export class UnavailableAiGateway implements AiGateway {
  sendCandidateContext(view: LlmView): Promise<void> {
    void view;
    throw new ServiceUnavailableException({ code: 'ML_UNAVAILABLE', message: 'The ML gateway adapter is not installed yet.' });
  }
}
