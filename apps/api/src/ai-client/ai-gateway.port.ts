import { LlmView } from '../privacy/to-llm-view.service';

export const AI_GATEWAY = Symbol('AI_GATEWAY');

export interface AiGateway {
  sendCandidateContext(view: LlmView): Promise<void>;
}
