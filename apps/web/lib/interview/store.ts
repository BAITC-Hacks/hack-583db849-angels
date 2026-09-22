'use client';

import { competencyOrder, type Competency } from '../drive';
import type { Score } from '../../components/evidence/ScoreMeter';
import { onReset, record } from '../demo/world';
import { previewDraft, previewTranscript } from './preview';
import { PreviewInterviewServer, TranscriptMissingError } from './previewServer';
import type { AssessmentDraft, InterviewTurn, InterviewerScores } from './types';

export type InterviewPhase = 'scoring' | 'saving' | 'saved';
export type TranscriptState = 'none' | 'transcribing' | 'ready';

export interface InterviewState {
  phase: InterviewPhase;
  scores: InterviewerScores;
  transcript: InterviewTurn[] | null;
  transcriptState: TranscriptState;
  draft: AssessmentDraft | null;
  waitingForTranscript: boolean;
  error: string | null;
}

const empty: InterviewerScores = { D: undefined, R: undefined, I: undefined, V: undefined, E: undefined };

const initial: InterviewState = {
  phase: 'scoring',
  scores: empty,
  transcript: null,
  transcriptState: 'none',
  draft: null,
  waitingForTranscript: false,
  error: null,
};

export type InterviewStore = ReturnType<typeof createInterviewStore>;

/**
 * One interview's state and the only way to change it. The draft is requested
 * only after the save succeeds, so before that it has never reached the
 * browser; it also needs the transcript, and follows it if the scores came
 * first. `report` tells the demo world what happened, for the role homes.
 */
export function createInterviewStore(api: PreviewInterviewServer, report = false) {
  let state = initial;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<InterviewState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  async function requestDraft() {
    try {
      set({ draft: await api.getDraft(), waitingForTranscript: false });
      if (report) record('draft-ready', 'A', { draftReady: true });
    } catch (caught) {
      if (caught instanceof TranscriptMissingError) set({ waitingForTranscript: true });
      else set({ error: caught instanceof Error ? caught.message : 'Could not load the draft.' });
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setScore(competency: Competency, score: Score) {
      if (state.phase === 'scoring') set({ scores: { ...state.scores, [competency]: score } });
    },
    fill(scores: InterviewerScores) {
      if (state.phase === 'scoring') set({ scores });
    },
    async save() {
      const complete = competencyOrder.every((competency) => state.scores[competency] !== undefined);
      if (state.phase !== 'scoring' || !complete) return;
      set({ phase: 'saving', error: null });
      try {
        await api.saveScores(state.scores);
        set({ phase: 'saved' });
        if (report) record('scores-saved', 'A', { scoresSaved: true });
      } catch (caught) {
        set({ phase: 'scoring', error: caught instanceof Error ? caught.message : 'Could not save.' });
        return;
      }
      await requestDraft();
    },
    async transcribe() {
      if (state.transcriptState !== 'none') return;
      set({ transcriptState: 'transcribing' });
      if (report) record('recording-loaded', 'A', { transcript: 'transcribing' });
      const transcript = await api.transcribe();
      set({ transcript, transcriptState: 'ready' });
      if (report) record('transcript-ready', 'A', { transcript: 'ready' });
      if (state.waitingForTranscript) await requestDraft();
    },
  };
}

// The demo's interview with candidate A survives leaving the page, and drops on reset.
let shared: InterviewStore | null = null;
onReset(() => {
  shared = null;
});

export function getSharedInterviewStore(): InterviewStore {
  if (!shared) shared = createInterviewStore(new PreviewInterviewServer(previewDraft, previewTranscript), true);
  return shared;
}
