import type { components } from '@invision/api-client';
import type { Score } from '../../../components/evidence/ScoreMeter';
import type { AssessmentDraft, InterviewRecord } from '../../interview/types';
import { codeFromLabel, toCompetencyScore } from './evidence';

type WireInterview = components['schemas']['InterviewDto'];
type WireDraft = components['schemas']['AssessmentDraftDto'];

/** The interview as its screen reads it. The saved scores come back from the server, so a reload shows them fixed. */
export function toInterviewRecord(interview: WireInterview): InterviewRecord {
  return {
    view: {
      interviewId: interview.interviewId,
      candidate: { id: interview.candidateId, code: codeFromLabel(interview.candidateLabel) },
      heldAt: interview.heldAt,
    },
    transcriptStatus: interview.transcriptStatus,
    transcript: (interview.transcript ?? []).map((turn) => ({
      turnId: turn.turnId,
      speaker: turn.speaker,
      text: turn.text,
      startSec: turn.startSec,
      endSec: turn.endSec,
    })),
    savedScores: interview.interviewerScores
      ? {
          D: interview.interviewerScores.D as Score,
          R: interview.interviewerScores.R as Score,
          I: interview.interviewerScores.I as Score,
          V: interview.interviewerScores.V as Score,
          E: interview.interviewerScores.E as Score,
        }
      : null,
  };
}

/**
 * The AI draft. It never saw the interviewer's scores, and nothing here mixes
 * the two: the screen compares them side by side, after the interviewer has
 * committed to their own.
 */
export function toAssessmentDraft(draft: WireDraft): AssessmentDraft {
  return { scores: draft.scores.map(toCompetencyScore) };
}
