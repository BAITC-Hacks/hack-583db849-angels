import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompetencyScore } from '../components/evidence/CompetencyScore';
import { EnglishMetricsPanel } from '../components/evidence/EnglishMetricsPanel';
import { EvidenceQuote, sourceLabel } from '../components/evidence/EvidenceQuote';
import { ScoreMeter } from '../components/evidence/ScoreMeter';

describe('evidence components', () => {
  it('shows a score out of four', () => {
    render(<ScoreMeter score={3} confidence="high" />);
    expect(screen.getByLabelText('Score 3 of 4')).toBeTruthy();
    expect(screen.getByText('high confidence')).toBeTruthy();
  });

  it('never shows a missing score as a number', () => {
    const { container } = render(<ScoreMeter score={null} />);
    expect(screen.getByText('Insufficient evidence')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('refuses to present a score that arrives without evidence', () => {
    const { container } = render(<CompetencyScore competency="V" score={4} confidence="high" evidence={[]} />);
    expect(screen.getByText('Insufficient evidence')).toBeTruthy();
    expect(container.textContent).not.toContain('4 / 4');
    expect(container.textContent).not.toContain('confidence');
  });

  it('shows every quote behind a supported score', () => {
    render(
      <CompetencyScore
        competency="E"
        score={3}
        evidence={[
          { quote: 'We freeze the backend by Thursday noon.', source: { kind: 'simulation_turn', id: 'turn_08' } },
          { quote: 'I split them into three teams.', source: { kind: 'application_field', id: 'leadership_example' } },
        ]}
      />,
    );
    expect(screen.getByText('“We freeze the backend by Thursday noon.”')).toBeTruthy();
    expect(screen.getByText('“I split them into three teams.”')).toBeTruthy();
    expect(screen.getByText('3 / 4')).toBeTruthy();
  });

  it('links a turn back to its place in the transcript', () => {
    render(<EvidenceQuote quote="Nobody asked you first." source={{ kind: 'simulation_turn', id: 'turn_04' }} />);
    expect(screen.getByText('Turn 04')).toBeTruthy();
    expect(screen.getByRole('link', { name: /show in context/i }).getAttribute('href')).toBe('#turn_04');
  });

  it('names every kind of source', () => {
    expect(sourceLabel({ kind: 'application_field', id: 'motivation' })).toBe('Application · motivation');
    expect(sourceLabel({ kind: 'test_item', id: 'block_03' })).toBe('Test · block_03');
    expect(sourceLabel({ kind: 'interview_note', id: 'note_2' })).toBe('Interview note 2');
  });

  it('keeps English apart from leadership and shows gaps as dashes', () => {
    const { container } = render(
      <EnglishMetricsPanel
        metrics={{
          cefrEstimate: 'B2',
          wordsPerMinute: null,
          meanTurnLength: 31.5,
          lexicalDiversity: 0.62,
          fillerRate: 0.04,
          grammarErrorsPer100Words: 2.1,
        }}
      />,
    );
    expect(screen.getByText(/never changes a D\.R\.I\.V\.E\. score/)).toBeTruthy();
    expect(screen.getByText('4.0%')).toBeTruthy();
    expect(container.textContent).toContain('—');
  });
});
