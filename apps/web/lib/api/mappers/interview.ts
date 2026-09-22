import type { AssessmentDraft, InterviewTurn, InterviewView } from '../../interview/types';
import type { WireAssessmentDraft, WireInterview, WireInterviewTurn } from '../contract';
import { codeFromLabel, toCompetencyScore } from './evidence';

export function toInterviewView(interview: WireInterview): InterviewView {
  return {
    interviewId: interview.interviewId,
    candidate: { id: interview.candidateId, code: codeFromLabel(interview.candidateLabel) },
    heldAt: interview.heldAt,
  };
}

export function toInterviewTranscript(interview: WireInterview): InterviewTurn[] {
  return interview.transcript.map((turn: WireInterviewTurn) => ({
    turnId: turn.turnId,
    speaker: turn.speaker,
    text: turn.text,
    startSec: turn.startSec,
    endSec: turn.endSec,
  }));
}

/**
 * The AI draft. It never saw the interviewer's scores, and nothing here mixes
 * the two: the screen compares them side by side, after the interviewer has
 * committed to their own.
 */
export function toAssessmentDraft(draft: WireAssessmentDraft): AssessmentDraft {
  return { scores: draft.scores.map(toCompetencyScore) };
}
