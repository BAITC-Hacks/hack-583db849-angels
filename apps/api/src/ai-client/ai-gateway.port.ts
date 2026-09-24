import { LlmView } from '../privacy/to-llm-view.service';
import type { components } from './schema';

export const AI_GATEWAY = Symbol('AI_GATEWAY');

export interface AiGateway {
  sendCandidateContext(view: LlmView): Promise<void>;
  scenarios(): Promise<components['schemas']['ScenarioBrief'][]>;
  simulationTurn(request: components['schemas']['TurnRequest']): Promise<components['schemas']['TurnResult']>;
  simulationAssessment(request: components['schemas']['AssessmentRequest']): Promise<components['schemas']['AssessmentResult']>;
  transcribeTurn(audioRef: string): Promise<components['schemas']['TranscribeResult']>;
  speech(text: string, scenarioId: string): Promise<Buffer>;
}
