import type { components } from '@invision/api-client';
import type { InterviewerBrief } from '../../brief/types';
import { toEvidence } from './evidence';

type WireBrief = components['schemas']['BriefDto'];
type WireConsistencyItem = components['schemas']['ConsistencyItemDto'];

function toConsistencyItem(item: WireConsistencyItem): InterviewerBrief['consistency'][number] {
  return {
    itemId: item.itemId,
    topic: item.topic,
    claim: { text: item.claim.text, evidence: item.claim.evidence.map(toEvidence) },
    observation: {
      text: item.observation.text,
      evidence: item.observation.evidence.map(toEvidence),
      metric: item.observation.metric,
    },
    status: item.status,
    whatToDo: item.whatToDo,
    askInInterview: item.askInInterview,
  };
}

/**
 * The interviewer brief. `sources` carries only the answers the quotes point
 * into, so the side panel shows exactly what was cited and nothing of the
 * profile — the API builds them from the same redacted view the model read.
 */
export function toInterviewerBrief(brief: WireBrief): InterviewerBrief {
  const surprise = brief.sources.surpriseAnswer;
  return {
    briefId: brief.briefId,
    candidateId: brief.candidateId,
    createdAt: brief.createdAt,
    application: brief.sources.application,
    test: brief.sources.test,
    summary: brief.summary,
    questions: brief.questions.map((question) => ({
      focus: question.focus,
      question: question.question,
      why: question.why,
      evidence: question.evidence.map(toEvidence),
    })),
    consistency: brief.consistency.map(toConsistencyItem),
    clarify: brief.clarify.map((topic) => ({ topic: topic.topic, evidence: topic.evidence.map(toEvidence) })),
    english: brief.english,
    surpriseAnswer: surprise ? { question: surprise.question, segments: surprise.segments } : null,
  };
}
