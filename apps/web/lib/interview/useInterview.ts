'use client';

import { useState } from 'react';
import type { Score } from '../../components/evidence/ScoreMeter';
import { errorText } from '../api/errors';
import { competencyOrder, type Competency } from '../drive';
import { useStaffLocale } from '../i18n/StaffLocaleProvider';
import { useInterviewDraft, useRedoDraft, useSaveScores, useUploadRecording } from './queries';
import type { AssessmentDraft, InterviewRecord, InterviewTurn, InterviewView, InterviewerScores, TranscriptStatus } from './types';

export type InterviewPhase = 'scoring' | 'saving' | 'saved';

export interface Interview {
  interview: InterviewView;
  phase: InterviewPhase;
  scores: InterviewerScores;
  complete: boolean;
  transcript: InterviewTurn[] | null;
  transcriptState: TranscriptStatus;
  draft: AssessmentDraft | null;
  waitingForTranscript: boolean;
  /** The draft has been missing for a while after both halves were there: offer to make it again. */
  draftSlow: boolean;
  error: string | null;
  uploading: boolean;
  uploadError: string | null;
  setScore: (competency: Competency, score: Score) => void;
  save: () => Promise<void>;
  /** The recording, sent with the candidate's consent for transcription. */
  upload: (audio: Blob) => void;
  redoDraft: () => void;
}

const empty: InterviewerScores = { D: undefined, R: undefined, I: undefined, V: undefined, E: undefined };

/**
 * The M4 screen's one door to an interview on the API. The interviewer's
 * scores live in the page until the server has them; after that they come
 * back from the server, fixed. The draft is asked for only then.
 */
export function useInterviewSession(record: InterviewRecord): Interview {
  const { locale } = useStaffLocale();
  const interviewId = record.view.interviewId;
  const [local, setLocal] = useState<InterviewerScores>(empty);
  const saving = useSaveScores(interviewId);
  const uploading = useUploadRecording(interviewId);
  const redo = useRedoDraft(interviewId);
  const saved = record.savedScores;
  const transcriptReady = record.transcriptStatus === 'ready';
  const draft = useInterviewDraft(interviewId, { scoresSaved: saved !== null, transcriptReady });

  const scores: InterviewerScores = saved ?? local;
  const complete = competencyOrder.every((competency) => scores[competency] !== undefined);
  const failure = saving.error ?? redo.error;

  return {
    interview: record.view,
    phase: saved ? 'saved' : saving.isPending ? 'saving' : 'scoring',
    scores,
    complete,
    transcript: transcriptReady ? record.transcript : null,
    transcriptState: record.transcriptStatus,
    draft: redo.data ?? draft.data ?? null,
    waitingForTranscript: saved !== null && !transcriptReady,
    draftSlow: transcriptReady && !draft.data && !redo.data && draft.errorUpdateCount >= 5,
    error: failure ? errorText(failure, locale) : null,
    uploading: uploading.isPending,
    uploadError: uploading.error ? errorText(uploading.error, locale) : null,
    setScore: (competency, score) => {
      if (!saved) setLocal((current) => ({ ...current, [competency]: score }));
    },
    save: async () => {
      if (saved || !complete || saving.isPending) return;
      await saving.mutateAsync(scores as Record<Competency, Score>).catch(() => undefined);
    },
    upload: (audio) => uploading.mutate({ audio, consent: true }),
    redoDraft: () => redo.mutate(),
  };
}
