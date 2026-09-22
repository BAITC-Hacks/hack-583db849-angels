'use client';

import { useCallback, useState } from 'react';
import { competencyOrder, type Competency } from '../drive';
import type { Score } from '../../components/evidence/ScoreMeter';
import { previewDraft, previewInterview, previewTranscript } from './preview';
import { PreviewInterviewServer, TranscriptMissingError } from './previewServer';
import type { AssessmentDraft, InterviewTurn, InterviewView, InterviewerScores } from './types';

export type InterviewPhase = 'scoring' | 'saving' | 'saved';
export type TranscriptState = 'none' | 'transcribing' | 'ready';

export interface Interview {
  interview: InterviewView;
  phase: InterviewPhase;
  scores: InterviewerScores;
  complete: boolean;
  transcript: InterviewTurn[] | null;
  transcriptState: TranscriptState;
  draft: AssessmentDraft | null;
  waitingForTranscript: boolean;
  error: string | null;
  preview: boolean;
  setScore: (competency: Competency, score: Score) => void;
  fill: (scores: InterviewerScores) => void;
  save: () => Promise<void>;
  /** The recording is finished (or the sample chosen): send it for transcription. */
  transcribe: () => Promise<void>;
}

const empty: InterviewerScores = { D: undefined, R: undefined, I: undefined, V: undefined, E: undefined };

/**
 * The M4 screen's only door to the server. The draft is requested only after
 * the save succeeds, so before that it is not merely hidden — it has never
 * reached the browser. A draft also needs the transcript; if the scores are
 * saved first, the draft follows as soon as the transcript arrives. Part 2
 * swaps the preview server for the generated client; the rules stay.
 */
export function useInterview(interviewId: string, server?: PreviewInterviewServer): Interview {
  const [api] = useState(() => server ?? new PreviewInterviewServer(previewDraft, previewTranscript));
  const [phase, setPhase] = useState<InterviewPhase>('scoring');
  const [scores, setScores] = useState<InterviewerScores>(empty);
  const [transcript, setTranscript] = useState<InterviewTurn[] | null>(null);
  const [transcriptState, setTranscriptState] = useState<TranscriptState>('none');
  const [draft, setDraft] = useState<AssessmentDraft | null>(null);
  const [waitingForTranscript, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  void interviewId;

  const complete = competencyOrder.every((competency) => scores[competency] !== undefined);

  const setScore = useCallback(
    (competency: Competency, score: Score) => {
      if (phase === 'scoring') setScores((current) => ({ ...current, [competency]: score }));
    },
    [phase],
  );

  const fill = useCallback(
    (next: InterviewerScores) => {
      if (phase === 'scoring') setScores(next);
    },
    [phase],
  );

  const requestDraft = useCallback(async () => {
    try {
      setDraft(await api.getDraft());
      setWaiting(false);
    } catch (caught) {
      if (caught instanceof TranscriptMissingError) setWaiting(true);
      else setError(caught instanceof Error ? caught.message : 'Could not load the draft.');
    }
  }, [api]);

  const save = useCallback(async () => {
    if (phase !== 'scoring' || !complete) return;
    setPhase('saving');
    setError(null);
    try {
      await api.saveScores(scores);
      setPhase('saved');
    } catch (caught) {
      setPhase('scoring');
      setError(caught instanceof Error ? caught.message : 'Could not save.');
      return;
    }
    await requestDraft();
  }, [api, complete, phase, requestDraft, scores]);

  const transcribe = useCallback(async () => {
    if (transcriptState !== 'none') return;
    setTranscriptState('transcribing');
    setTranscript(await api.transcribe());
    setTranscriptState('ready');
    // Scores saved before the transcript existed: the draft can be written now.
    if (waitingForTranscript) await requestDraft();
  }, [api, requestDraft, transcriptState, waitingForTranscript]);

  return {
    interview: previewInterview,
    phase,
    scores,
    complete,
    transcript,
    transcriptState,
    draft,
    waitingForTranscript,
    error,
    preview: true,
    setScore,
    fill,
    save,
    transcribe,
  };
}
