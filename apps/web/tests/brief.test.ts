import { describe, expect, it } from 'vitest';
import { previewBrief } from '../lib/brief/preview';
import { competencyOrder } from '../lib/drive';
import type { BriefEvidence, BriefFocus } from '../lib/brief/types';

function sourceText(item: BriefEvidence): string | undefined {
  if (item.source.kind === 'application_field') {
    return previewBrief.application.find((answer) => answer.fieldId === item.source.id)?.answer;
  }
  if (item.source.kind === 'test_item') {
    return previewBrief.test.find((response) => response.itemId === item.source.id)?.response;
  }
  return undefined;
}

const everyEvidence = [
  ...previewBrief.questions.flatMap((question) => question.evidence),
  ...previewBrief.consistency.flatMap((item) => [...item.claim.evidence, ...item.observation.evidence]),
  ...previewBrief.clarify.flatMap((topic) => topic.evidence),
];

const focuses: BriefFocus[] = [...competencyOrder, 'invision_knowledge', 'english', 'motivation'];

describe('preview brief', () => {
  it('quotes every source word for word', () => {
    for (const item of everyEvidence) {
      const text = sourceText(item);
      expect(text, `${item.source.kind}:${item.source.id}`).toBeDefined();
      expect(text).toContain(item.quote);
    }
  });

  it('asks about all five competencies and the three topics no rubric covers', () => {
    const asked = new Set(previewBrief.questions.map((question) => question.focus));
    for (const focus of focuses) expect(asked.has(focus), focus).toBe(true);
  });

  it('pairs each claim with what was actually measured or heard', () => {
    expect(previewBrief.consistency.length).toBeGreaterThan(0);
    for (const item of previewBrief.consistency) {
      // A claim is always the candidate's own words. An observation is a quote
      // or a measured value — unless the status is `unverified`, which is the
      // honest case of nothing to observe yet.
      expect(item.claim.evidence.length, item.itemId).toBeGreaterThan(0);
      const observed = item.observation.evidence.length > 0 || item.observation.metric !== null;
      expect(observed || item.status === 'unverified', item.itemId).toBe(true);
      expect(item.whatToDo.length, item.itemId).toBeGreaterThan(0);
    }
  });

  it('turns anything that does not match into a question for the interview', () => {
    for (const item of previewBrief.consistency) {
      if (item.status === 'discrepancy' || item.status === 'unverified') {
        expect(item.askInInterview, item.itemId).toBeTruthy();
      }
    }
  });

  it('says nothing that reads as a decision or a score', () => {
    const prose = [
      previewBrief.summary,
      ...previewBrief.questions.flatMap((question) => [question.question, question.why]),
      ...previewBrief.consistency.flatMap((item) => [item.claim.text, item.observation.text, item.whatToDo, item.askInInterview ?? '']),
      ...previewBrief.clarify.map((topic) => topic.topic),
    ].join(' ');
    expect(prose).not.toMatch(/\b(reject|accept|admit|pass|fail|score|rank|recommend)\w*/i);
  });
});
