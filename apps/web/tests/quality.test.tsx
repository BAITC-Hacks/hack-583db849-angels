import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QualityCheckPanel } from '../components/quality/QualityPanel';
import { previewCalibrationCheck, previewInterviewCheck } from '../lib/quality/preview';
import { previewTranscript } from '../lib/interview/preview';
import { navItems } from '../lib/navigation';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/' }));

describe('the quality guard panel', () => {
  it('shows what the interview check found, with the question it is about', () => {
    render(<QualityCheckPanel check={previewInterviewCheck} />);

    expect(screen.getByText('Leading question')).toBeTruthy();
    expect(screen.getByText('Question that may not be asked')).toBeTruthy();
    expect(screen.getByText(/You would agree that finishing on time matters most/)).toBeTruthy();
    expect(screen.getByText(/What do your parents do for a living/)).toBeTruthy();
  });

  it('quotes the interviewer word for word from the transcript', () => {
    const questions = previewTranscript.filter((turn) => turn.speaker === 'interviewer').map((turn) => turn.text);
    for (const signal of previewInterviewCheck.signals) {
      for (const evidence of signal.evidence) {
        expect(questions.some((question) => question.includes(evidence.quote)), evidence.quote).toBe(true);
      }
    }
  });

  it('marks the competencies the questions never reached', () => {
    render(<QualityCheckPanel check={previewInterviewCheck} />);

    expect(screen.getByText('V · Not reached')).toBeTruthy();
    expect(screen.getByText('I · Not reached')).toBeTruthy();
    expect(screen.getByText('D · Asked about')).toBeTruthy();
  });

  it('shows who spoke, because an interviewer who holds the time hears least', () => {
    render(<QualityCheckPanel check={previewInterviewCheck} />);
    expect(screen.getByText(/Interviewer 34% · Candidate 66%/)).toBeTruthy();
  });

  it('puts the interviewer scale beside the panel, not beside a candidate', () => {
    const { container } = render(<QualityCheckPanel check={previewCalibrationCheck} />);

    expect(screen.getByText('Scale drift')).toBeTruthy();
    expect(screen.getByText('+1.1')).toBeTruthy();
    expect(container.textContent).not.toMatch(/candidate a/i);
  });
});

describe('what a check may never say', () => {
  it('never names a candidate or reads as a verdict', () => {
    for (const check of [previewInterviewCheck, previewCalibrationCheck]) {
      const prose = check.signals.flatMap((signal) => [signal.message, signal.recommendation]).join(' ');
      expect(prose).not.toMatch(/\b(bias|candidate|reject|accept|admit)\w*/i);
      expect(JSON.stringify(check)).not.toContain('candidateId');
    }
  });

  it('gives every signal something a person can do next', () => {
    for (const check of [previewInterviewCheck, previewCalibrationCheck]) {
      for (const signal of check.signals) expect(signal.recommendation.length, signal.kind).toBeGreaterThan(0);
    }
  });
});

describe('the sidebar', () => {
  it('takes the commission to the panel now that it exists', () => {
    const quality = navItems.find((item) => item.id === 'quality');
    expect(quality?.href).toBe('/commission/quality-guard');
    expect(quality?.roles).toEqual(['commission', 'admin']);
  });
});
