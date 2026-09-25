import type { components } from './schema';

export const AI_GATEWAY = Symbol('AI_GATEWAY');

export interface AiGateway {
  brief(request: components['schemas']['BriefRequest']): Promise<components['schemas']['BriefResult']>;
  scenarios(): Promise<components['schemas']['ScenarioBrief'][]>;
  simulationTurn(request: components['schemas']['TurnRequest']): Promise<components['schemas']['TurnResult']>;
  simulationAssessment(request: components['schemas']['AssessmentRequest']): Promise<components['schemas']['AssessmentResult']>;
  transcribeTurn(audioRef: string): Promise<components['schemas']['TranscribeResult']>;
  surpriseQuestion(request: components['schemas']['SurpriseRequest']): Promise<components['schemas']['SurpriseResult']>;
  /** The audio track of a surprise answer, one speaker. Never the video. */
  transcribeSurprise(audioRef: string): Promise<components['schemas']['TranscribeResult']>;
  qualityCheck(request: components['schemas']['QualityCheckRequest']): Promise<components['schemas']['QualityCheckResult']>;
  speech(text: string, scenarioId: string): Promise<Buffer>;
}
