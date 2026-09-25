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
  /** An interview recording, two speakers. The audio only; it is deleted once the transcript is stored. */
  transcribeInterview(audioRef: string): Promise<components['schemas']['TranscribeResult']>;
  /** The draft reads the transcript and the notes, and never the interviewer's scores. */
  interviewDraft(request: components['schemas']['DraftRequest']): Promise<components['schemas']['DraftResult']>;
  /** C: claimed against measured. After the interview it reads the transcript, and never the interviewer's scores. */
  consistency(request: components['schemas']['ConsistencyRequest']): Promise<components['schemas']['ConsistencyResult']>;
  /** The gateway's mode, calls and spend, for the admin. */
  usage(): Promise<components['schemas']['Usage']>;
  speech(text: string, scenarioId: string): Promise<Buffer>;
}
