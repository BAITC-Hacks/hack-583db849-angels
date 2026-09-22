'use client';

import { useState, useSyncExternalStore } from 'react';
import { competencyOrder, type Competency } from '../drive';
import type { Score } from '../../components/evidence/ScoreMeter';
import { subscribeWorld } from '../demo/world';
import { previewInterview } from './preview';
import type { PreviewInterviewServer } from './previewServer';
import { createInterviewStore, getSharedInterviewStore, type InterviewState } from './store';
import type { InterviewView, InterviewerScores } from './types';

export type { InterviewPhase, TranscriptState } from './store';

export interface Interview extends InterviewState {
  interview: InterviewView;
  complete: boolean;
  preview: boolean;
  setScore: (competency: Competency, score: Score) => void;
  fill: (scores: InterviewerScores) => void;
  save: () => Promise<void>;
  /** The recording is finished (or the sample chosen): send it for transcription. */
  transcribe: () => Promise<void>;
}

/**
 * The M4 screen's only door to the interview. Normally the demo's shared
 * interview with candidate A; a test passes its own server for a fresh one.
 * Part 2 swaps the preview server for the generated client; the rules stay.
 */
export function useInterview(interviewId: string, server?: PreviewInterviewServer): Interview {
  const [local] = useState(() => (server ? createInterviewStore(server) : null));
  const sharedStore = useSyncExternalStore(subscribeWorld, getSharedInterviewStore, getSharedInterviewStore);
  const store = local ?? sharedStore;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  void interviewId;

  return {
    ...state,
    interview: previewInterview,
    complete: competencyOrder.every((competency) => state.scores[competency] !== undefined),
    preview: true,
    setScore: store.setScore,
    fill: store.fill,
    save: store.save,
    transcribe: store.transcribe,
  };
}
