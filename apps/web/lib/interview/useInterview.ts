'use client';

import { useCallback, useState } from 'react';
import { competencyOrder, type Competency } from '../drive';
import type { Score } from '../../components/evidence/ScoreMeter';
import { previewDraft, previewInterview } from './preview';
import { PreviewInterviewServer } from './previewServer';
import type { AssessmentDraft, InterviewView, InterviewerScores } from './types';

export type InterviewPhase = 'scoring' | 'saving' | 'saved';

export interface Interview {
  interview: InterviewView;
  phase: InterviewPhase;
  scores: InterviewerScores;
  complete: boolean;
  draft: AssessmentDraft | null;
  error: string | null;
  preview: boolean;
  setScore: (competency: Competency, score: Score) => void;
  fill: (scores: InterviewerScores) => void;
  save: () => Promise<void>;
}

const empty: InterviewerScores = { D: undefined, R: undefined, I: undefined, V: undefined, E: undefined };

/**
 * The M4 screen's only door to the server. The draft is requested only after
 * the save succeeds, so before that it is not merely hidden — it has never
 * reached the browser. Part 2 swaps the preview server for the generated
 * client; the rule and the components stay.
 */
export function useInterview(interviewId: string, server?: PreviewInterviewServer): Interview {
  const [api] = useState(() => server ?? new PreviewInterviewServer(previewDraft));
  const [phase, setPhase] = useState<InterviewPhase>('scoring');
  const [scores, setScores] = useState<InterviewerScores>(empty);
  const [draft, setDraft] = useState<AssessmentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  void interviewId;

  const complete = competencyOrder.every((competency) => scores[competency] !== undefined);

  const setScore = useCallback(
    (competency: Competency, score: Score) => {
      if (phase === 'scoring') setScores((current) => ({ ...current, [competency]: score }));
    },
    [phase],
  );

  const fill = useCallback((next: InterviewerScores) => {
    if (phase === 'scoring') setScores(next);
  }, [phase]);

  const save = useCallback(async () => {
    if (phase !== 'scoring' || !complete) return;
    setPhase('saving');
    setError(null);
    try {
      await api.saveScores(scores);
      setPhase('saved');
      setDraft(await api.getDraft());
    } catch (caught) {
      setPhase('scoring');
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    }
  }, [api, complete, phase, scores]);

  return { interview: previewInterview, phase, scores, complete, draft, error, preview: true, setScore, fill, save };
}
