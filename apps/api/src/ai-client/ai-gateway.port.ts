import { LlmView } from '../privacy/to-llm-view.service';
import type { components } from './schema';

export const AI_GATEWAY = Symbol('AI_GATEWAY');

export interface AiGateway {
  sendCandidateContext(view: LlmView): Promise<void>;
  scenarios(): Promise<components['schemas']['ScenarioBrief'][]>;
}
