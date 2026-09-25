/**
 * The wire types, copied from `docs/contracts/api.md`.
 *
 * Temporary. Each one is deleted the moment `apps/api/openapi.json` covers its
 * endpoint and the generated client can be imported instead — the client is
 * built from that file, so it cannot drift. Nothing outside `lib/api/mappers`
 * may import from here: screens use their own shapes.
 */
import type { Competency } from '../drive';

export type Confidence = 'low' | 'medium' | 'high';
export type Score = 0 | 1 | 2 | 3 | 4 | null;

export interface WireEvidence {
  source: 'application_field' | 'test_item' | 'simulation_turn' | 'interview_turn' | 'interview_note' | 'surprise_answer';
  sourceId: string;
  quote: string;
}

export interface WireDriveScore {
  competency: Competency;
  score: Score;
  confidence: Confidence | null;
  rationale: string | null;
  evidence: WireEvidence[];
}

export interface WireTurn {
  turnId: string;
  speaker: 'candidate' | 'character';
  text: string;
  startedAt: string;
  endedAt: string;
  /** Candidate turns in API responses (docs/SPEC.md, Turn). */
  recognitionConfidence?: number | null;
}

export interface WireEnglishMetrics {
  cefrEstimate: string | null;
  wordsPerMinute: number | null;
  fillerRate: number | null;
  meanTurnLength: number | null;
  lexicalDiversity: number | null;
  grammarErrorsPer100Words: number | null;
}

export interface WireScenario {
  scenarioId: string;
  title: string;
  situation: string;
  yourRole: string;
  goal: string;
  character: { name: string; role: string; wants: string };
  expectedMinutes: number;
  maxCandidateTurns: number;
}

export interface WireSimulation {
  simulationId: string;
  candidateId: string;
  scenario: WireScenario;
  mode: 'voice' | 'text';
  accommodation: boolean;
  status: 'active' | 'completed';
  stage: 'opening' | 'in-progress' | 'wrapping-up' | 'finished';
  ending: 'completed' | 'stopped' | null;
  startedAt: string;
  completedAt: string | null;
  turns: WireTurn[];
}

export interface WireTurnResult {
  candidateTurn: WireTurn | null;
  characterTurn: WireTurn;
  stage: WireSimulation['stage'];
  status: WireSimulation['status'];
  candidateTurns: number;
  recognitionConfidence: number | null;
  characterAudioUrl: string | null;
}

export interface WireAssessment {
  assessmentId: string;
  simulationId: string;
  candidateId: string;
  candidateLabel: string;
  createdAt: string;
  simulation: {
    scenarioTitle: string;
    characterName: string;
    mode: 'voice' | 'text';
    accommodation: boolean;
    completedAt: string;
    durationSeconds: number;
    turns: WireTurn[];
  };
  scores: WireDriveScore[];
  english: WireEnglishMetrics;
  interviewQuestions: { competency: Competency; question: string; reason: string }[];
}

export interface WireCandidateFeedback {
  assessmentId: string;
  scenarioTitle: string;
  strengths: string[];
  growth: string[];
  nextTime: string[];
}

export interface WireInterviewTurn {
  turnId: string;
  speaker: 'interviewer' | 'candidate';
  text: string;
  startSec: number;
  endSec: number;
}

export interface WireInterview {
  interviewId: string;
  candidateId: string;
  candidateLabel: string;
  heldAt: string;
  transcriptStatus: 'none' | 'transcribing' | 'ready' | 'failed';
  transcriptSource: 'platform' | 'recording' | null;
  transcript: WireInterviewTurn[];
  notes?: { id: string; text: string }[];
}

export interface WireAssessmentDraft {
  interviewId: string;
  createdAt: string;
  scores: WireDriveScore[];
}

/**
 * Every step is nullable, and null means two things at once: the step has not
 * started, or this role may not see it. The screens treat both the same way —
 * an interviewer is sent no assessment because they score blind, and that is
 * not a state they need to tell apart from "not run yet".
 */
export interface WireCandidateProgress {
  candidateId: string;
  label: string;
  brief: { briefId: string | null; status: 'not_started' | 'pending' | 'ready' | 'failed' } | null;
  simulation: { simulationId: string | null; status: 'not_started' | 'active' | 'completed'; ending: 'completed' | 'stopped' | null } | null;
  assessment: { assessmentId: string | null; status: 'not_started' | 'pending' | 'ready' | 'failed' } | null;
  interview: { interviewId: string | null; transcriptStatus: WireInterview['transcriptStatus']; scoresSaved: boolean; draftReady: boolean } | null;
  surprise: { surpriseId: string | null; status: string } | null;
  consistency: { before: string | null; after: string | null } | null;
}

export interface WireCandidate {
  candidateId: string;
  externalId: string;
  label: string;
  createdAt: string;
  progress?: WireCandidateProgress;
}
