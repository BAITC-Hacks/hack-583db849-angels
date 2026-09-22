import { describe, expect, it } from 'vitest';
import { previewBrief } from '../lib/brief/preview';
import { competencyOrder } from '../lib/drive';
import type { BriefEvidence } from '../lib/brief/types';

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
  ...previewBrief.flags.flatMap((flag) => flag.sources),
  ...previewBrief.clarify.flatMap((topic) => topic.evidence),
];

describe('preview brief', () => {
  it('quotes every source word for word', () => {
    for (const item of everyEvidence) {
      const text = sourceText(item);
      expect(text, `${item.source.kind}:${item.source.id}`).toBeDefined();
      expect(text).toContain(item.quote);
    }
  });

  it('asks about every D.R.I.V.E. competency', () => {
    const asked = new Set(previewBrief.questions.map((question) => question.competency));
    for (const competency of competencyOrder) expect(asked.has(competency), competency).toBe(true);
  });

  it('builds every inconsistency from two different sources', () => {
    for (const flag of previewBrief.flags) {
      const [a, b] = flag.sources;
      expect(`${a.source.kind}:${a.source.id}`).not.toBe(`${b.source.kind}:${b.source.id}`);
    }
  });

  it('says nothing that reads as a decision or a score', () => {
    const prose = [
      previewBrief.summary,
      ...previewBrief.questions.flatMap((question) => [question.question, question.why]),
      ...previewBrief.flags.flatMap((flag) => [flag.title, flag.ask]),
      ...previewBrief.clarify.map((topic) => topic.topic),
    ].join(' ');
    expect(prose).not.toMatch(/\b(reject|accept|admit|pass|fail|score|rank|recommend)\w*/i);
  });
});
