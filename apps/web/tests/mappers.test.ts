import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  WireAssessment,
  WireAssessmentDraft,
  WireCandidate,
  WireCandidateFeedback,
  WireCandidateProgress,
  WireInterview,
  WireSimulation,
  WireTurnResult,
} from '../lib/api/contract';
import { toCandidateFeedback, toSimulationReport } from '../lib/api/mappers/assessment';
import { toScreenProgress, toScreenProgressList } from '../lib/api/mappers/candidates';
import { toAssessmentDraft, toInterviewTranscript, toInterviewView } from '../lib/api/mappers/interview';
import { appendTurn, toScenarioBrief, toSimulationState } from '../lib/api/mappers/simulation';
import { previewDraft, previewInterview, previewTranscript } from '../lib/interview/preview';
import { previewFeedback, previewReport } from '../lib/report/preview';
import { previewScenario } from '../lib/simulation/previewScenario';

/**
 * The golden test of the data layer: every example in the contract, put
 * through its mapper, gives exactly what the screen shows on its preview
 * today. If the API ever answers something the screens cannot render, this
 * fails here — before a screen is wired to it, not during the demo.
 */
const examples = join(process.cwd(), '../../docs/contracts/examples/candidate-a');
const example = <T>(name: string): T => JSON.parse(readFileSync(join(examples, name), 'utf8')) as T;

describe('the commission report', () => {
  const assessment = example<WireAssessment>('assessment.json');
  const report = toSimulationReport(assessment);

  it('is exactly what the report screen renders', () => {
    expect(report).toEqual({ ...previewReport, assessmentId: assessment.assessmentId });
  });

  it('keeps every quote word for word in the turn it cites', () => {
    for (const score of report.scores) {
      for (const evidence of score.evidence) {
        const turn = report.turns.find((candidate) => candidate.turnId === evidence.source.id);
        expect(turn, `${evidence.source.kind}:${evidence.source.id}`).toBeDefined();
        expect(turn?.text).toContain(evidence.quote);
      }
    }
  });

  it('shows a competency with no evidence as no score at all', () => {
    const values = report.scores.filter((score) => score.evidence.length === 0).map((score) => score.score);
    for (const value of values) expect(value).toBeNull();
  });
});

describe("the candidate's feedback", () => {
  const feedback = example<WireCandidateFeedback>('candidate-feedback.json');
  const mapped = toCandidateFeedback(feedback);

  it('is exactly what the feedback page renders', () => {
    expect(mapped).toEqual({ ...previewFeedback, assessmentId: feedback.assessmentId });
  });

  it('carries no digit anywhere, because it carries no score', () => {
    const text = [...mapped.strengths, ...mapped.growth, ...mapped.nextTime].join(' ');
    expect(text).not.toMatch(/\d/);
  });
});

describe('the interview', () => {
  const interview = example<WireInterview>('interview.json');

  it('is exactly what the interview screen renders', () => {
    expect(toInterviewView(interview)).toEqual({ ...previewInterview, interviewId: interview.interviewId });
    expect(toInterviewTranscript(interview)).toEqual(previewTranscript);
  });

  it('maps the draft the way the comparison expects it', () => {
    expect(toAssessmentDraft(example<WireAssessmentDraft>('assessment-draft.json'))).toEqual(previewDraft);
  });
});

describe('the simulation', () => {
  const created = example<WireSimulation>('simulation-created.json');

  it('gives the screen the scenario it already shows', () => {
    expect(toScenarioBrief(created)).toEqual(previewScenario);
  });

  it('starts with the character speaking first and nothing else', () => {
    const state = toSimulationState(created);
    expect(state.stage).toBe('opening');
    expect(state.candidateTurns).toBe(0);
    expect(state.turns.map((turn) => turn.speaker)).toEqual(['character']);
    expect(state.ending).toBeNull();
  });

  it('appends the transcribed turn and the reply, in that order', () => {
    const state = appendTurn(toSimulationState(created), example<WireTurnResult>('simulation-turn.json'));
    expect(state.turns.map((turn) => turn.turnId)).toEqual(['turn_01', 'turn_02', 'turn_03']);
    expect(state.turns.map((turn) => turn.speaker)).toEqual(['character', 'candidate', 'character']);
    expect(state.candidateTurns).toBe(1);
    expect(state.replying).toBe(false);
  });

  it('ends when the API says the simulation is over', () => {
    const completed = example<WireSimulation>('simulation-completed.json');
    const state = toSimulationState(completed);
    expect(state.stage).toBe('finished');
    expect(state.ending).toBe('completed');
  });
});

describe('a candidate on a home screen', () => {
  it('reads every step from one progress call', () => {
    const progress = toScreenProgress(example<WireCandidateProgress>('candidate-progress.commission.json'));
    expect(progress).toEqual({
      code: 'A',
      id: '00000000-0000-4000-8000-00000000000a',
      hasData: true,
      briefViewed: true,
      simulation: 'completed',
      assessmentReady: true,
      transcript: 'ready',
      scoresSaved: true,
      draftReady: true,
    });
  });

  it('reads a step the role may not see as not started', () => {
    // The platform key is sent no brief and no interview at all: a candidate
    // must not reach either through inVision's own system.
    const progress = toScreenProgress(example<WireCandidateProgress>('candidate-progress.platform.json'));
    expect(progress.briefViewed).toBe(false);
    expect(progress.scoresSaved).toBe(false);
    expect(progress.draftReady).toBe(false);
    expect(progress.transcript).toBe('none');
  });

  it('reads a candidate who has only been registered', () => {
    const { items } = example<{ items: WireCandidate[] }>('candidates.json');
    const b = toScreenProgress(items[1].progress as WireCandidateProgress);
    expect(b.simulation).toBe('not-started');
    expect(b.assessmentReady).toBe(false);
  });

  it('maps the list the way the tables read it', () => {
    const { items } = example<{ items: WireCandidate[] }>('candidates.json');
    const rows = toScreenProgressList(items);
    expect(rows.map((row) => row.code)).toEqual(['A', 'B', 'C']);
    expect(rows[0].simulation).toBe('completed');
  });
});
