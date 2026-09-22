import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeedbackView } from '../components/report/FeedbackView';
import { previewFeedback, previewReport } from '../lib/report/preview';

describe('preview report', () => {
  it('quotes every piece of evidence word for word from a candidate turn', () => {
    const turns = new Map(previewReport.turns.map((turn) => [turn.turnId, turn]));
    for (const score of previewReport.scores) {
      for (const item of score.evidence) {
        const turn = turns.get(item.source.id);
        expect(turn, `${score.competency}: ${item.source.id}`).toBeDefined();
        expect(turn!.speaker).toBe('candidate');
        expect(turn!.text).toContain(item.quote);
      }
    }
  });

  it('never carries a score without evidence', () => {
    for (const score of previewReport.scores) {
      if (score.score !== null) expect(score.evidence.length, score.competency).toBeGreaterThan(0);
    }
  });

  it('numbers turns in order, alternating from the character', () => {
    previewReport.turns.forEach((turn, index) => {
      expect(turn.turnId).toBe(`turn_${String(index + 1).padStart(2, '0')}`);
      expect(turn.speaker).toBe(index % 2 === 0 ? 'character' : 'candidate');
    });
  });

  it('asks the live interview about every competency left without evidence', () => {
    const missing = previewReport.scores.filter((score) => score.score === null).map((score) => score.competency);
    const asked = previewReport.interviewQuestions.map((question) => question.competency);
    for (const competency of missing) expect(asked).toContain(competency);
  });
});

describe('candidate feedback', () => {
  it('contains no score, number or decision language', () => {
    const { container } = render(<FeedbackView feedback={previewFeedback} />);
    const items = [...previewFeedback.strengths, ...previewFeedback.growth, ...previewFeedback.nextTime].join(' ');
    expect(items).not.toMatch(/\d/);
    expect(items).not.toMatch(/\b(score|rank|admit|reject|accept|pass|fail(ed)?)\b/i);
    expect(container.textContent).not.toMatch(/\d\s*\/\s*4/);
  });
});
