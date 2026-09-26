import type { CandidateProgress as ScreenProgress } from '../../home/types';
import type { WireCandidate, WireCandidateProgress } from '../contract';
import { candidateTag, seedCode } from './evidence';

const simulationStage = {
  not_started: 'not-started',
  active: 'in-progress',
  completed: 'completed',
} as const;

/**
 * What every role's home reads. The API filters the fields by role — an
 * interviewer is sent no assessment, `platform` no brief and no score — so a
 * step the caller may not see simply arrives missing, and reads as not started.
 *
 * `briefViewed` is the one thing the server deliberately does not keep
 * (`docs/INTEGRATION.md`, G13): the step follows whether the brief is ready,
 * not whether someone opened it.
 */
export function toScreenProgress(progress: WireCandidateProgress): ScreenProgress {
  const interview = progress.interview;
  const briefReady = progress.brief?.status === 'ready';
  const simulation = progress.simulation?.status ?? 'not_started';

  return {
    code: seedCode(progress.label),
    tag: candidateTag(progress.label),
    id: progress.candidateId,
    // A brief at all — even one still being written, or one that failed — is something to show.
    hasData: Boolean(progress.brief) || simulation !== 'not_started',
    briefViewed: briefReady,
    simulation: simulationStage[simulation],
    assessmentReady: progress.assessment?.status === 'ready',
    assessmentId: progress.assessment?.assessmentId ?? null,
    interviewId: interview?.interviewId ?? null,
    transcript: interview?.transcriptStatus === 'ready' ? 'ready' : interview?.transcriptStatus === 'transcribing' ? 'transcribing' : 'none',
    scoresSaved: interview?.scoresSaved ?? false,
    draftReady: interview?.draftReady ?? false,
  };
}

export function toScreenProgressList(candidates: WireCandidate[]): ScreenProgress[] {
  return candidates
    .filter((candidate): candidate is WireCandidate & { progress: WireCandidateProgress } => Boolean(candidate.progress))
    .map((candidate) => toScreenProgress(candidate.progress));
}
