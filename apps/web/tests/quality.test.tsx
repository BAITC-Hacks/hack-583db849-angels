import type { components } from '@invision/api-client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CommissionHome from '../app/(product)/commission/page';
import { QualityGuardScreen } from '../components/quality/QualityGuardScreen';
import { QualityCheckPanel } from '../components/quality/QualityPanel';
import type { WireCandidate } from '../lib/api/contract';
import { toQualityCheck } from '../lib/api/mappers/quality';
import { navItems } from '../lib/navigation';
import { apiError, example, json, mockApi, withQuery } from './apiHarness';

type WireCheck = components['schemas']['QualityCheckDto'];
const wireInterview = example<WireCheck>('quality-check-interview.json');
const wireCalibration = example<WireCheck>('quality-check-calibration.json');
const previewInterviewCheck = toQualityCheck(wireInterview);
const previewCalibrationCheck = toQualityCheck(wireCalibration);
const previewTranscript = example<{ transcript: { speaker: string; text: string }[] }>('interview.json').transcript;

afterEach(() => vi.unstubAllGlobals());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => '/' }));

describe('the quality guard panel, on the contract examples', () => {
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

describe('the panel on the API', () => {
  it('shows the newest check of each kind', async () => {
    mockApi({ 'GET /api/v1/quality-checks': () => json({ items: [wireCalibration, wireInterview] }) });
    withQuery(<QualityGuardScreen />);
    expect(await screen.findByText('Leading question')).toBeTruthy();
    expect(screen.getByText('Scale drift')).toBeTruthy();
    expect(screen.getByText(/interviewer-2 · 2026-09-01 – 2026-09-30 · 15 interviews/)).toBeTruthy();
    expect(screen.queryByText(/Preview/)).toBeNull();
  });

  it('checks an interviewer’s scale over this month, and says when there is too little history', async () => {
    let refuse = true;
    const calls = mockApi({
      'GET /api/v1/quality-checks': () => json({ items: [] }),
      'POST /api/v1/quality-checks/calibration': () => (refuse ? apiError(409, 'NOT_ENOUGH_HISTORY') : json(wireCalibration, 201)),
    });
    withQuery(<QualityGuardScreen />);
    expect(await screen.findByText(/No interview has been checked yet/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Interviewer'), { target: { value: 'synthetic-interviewer-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check the scale' }));
    expect(await screen.findByText(/Fewer than three scored interviews/)).toBeTruthy();

    refuse = false;
    fireEvent.click(screen.getByRole('button', { name: 'Check the scale' }));
    expect(await screen.findByText('Scale drift')).toBeTruthy();

    const posts = calls.filter((call) => call.method === 'POST');
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    expect(JSON.parse(posts[0].body as string)).toMatchObject({ interviewerRef: 'synthetic-interviewer-a', from });
    expect(posts[1].headers.get('Idempotency-Key')).toBe(posts[0].headers.get('Idempotency-Key'));
  });

  it('tells a role that may not see the checks so', async () => {
    mockApi({ 'GET /api/v1/quality-checks': () => apiError(403, 'FORBIDDEN') });
    withQuery(<QualityGuardScreen />);
    expect(await screen.findByText('This role does not see the quality checks.')).toBeTruthy();
  });

  it('counts the signals of the newest checks on the commission’s home', async () => {
    const list = example<{ items: WireCandidate[] }>('candidates.json');
    mockApi({
      'GET /api/v1/candidates': () => json(list),
      'GET /api/v1/quality-checks': () => json({ items: [wireInterview, wireCalibration] }),
    });
    withQuery(<CommissionHome />);
    const total = String(wireInterview.signals.length + wireCalibration.signals.length);
    await waitFor(() => expect(screen.getByText('Quality signals').closest('a')?.textContent).toContain(total));
  });
});
