import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessmentGate } from '../components/home/AssessmentGate';
import { FeedbackScreen, ReportScreen } from '../components/report/ReportScreen';
import type { WireAssessment, WireCandidate, WireCandidateFeedback } from '../lib/api/contract';
import { DemoRoleProvider } from '../lib/DemoRoleProvider';
import type { DemoRole } from '../lib/roles';
import { apiError, example, json, mockApi, withQuery } from './apiHarness';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/' }));

const assessment = example<WireAssessment>('assessment.json');
const feedback = example<WireCandidateFeedback>('candidate-feedback.json');
const candidates = example<{ items: WireCandidate[] }>('candidates.json');
const id = assessment.assessmentId;
const reportPath = `/api/v1/simulation-assessments/${id}`;

beforeEach(() => replace.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('the commission report on the API', () => {
  it('renders the report, and every quote links to its turn', async () => {
    mockApi({ [`GET ${reportPath}`]: () => json(assessment) });
    const { container } = withQuery(<ReportScreen assessmentId={id} />);
    expect(await screen.findByRole('heading', { name: 'Candidate A' })).toBeTruthy();
    const links = [...container.querySelectorAll('a[href^="#turn_"]')].map((link) => link.getAttribute('href'));
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) expect(container.querySelector(href!)).not.toBeNull();
  });

  it('says a simulation was typed by accommodation, and marks a turn the recogniser was unsure of', async () => {
    const typedAndUnsure: WireAssessment = {
      ...assessment,
      simulation: {
        ...assessment.simulation,
        mode: 'text',
        accommodation: true,
        turns: assessment.simulation.turns.map((turn) =>
          turn.turnId === 'turn_02' ? { ...turn, recognitionConfidence: 0.42 } : turn,
        ),
      },
    };
    mockApi({ [`GET ${reportPath}`]: () => json(typedAndUnsure) });
    withQuery(<ReportScreen assessmentId={id} />);
    expect(await screen.findByText('Text, switched on by staff')).toBeTruthy();
    expect(screen.getByText(/Recogniser unsure .*\(0\.42\)/)).toBeTruthy();
  });

  it('tells a role that may not read it, and a report that does not exist, apart', async () => {
    mockApi({ [`GET ${reportPath}`]: () => apiError(403, 'FORBIDDEN') });
    const first = withQuery(<ReportScreen assessmentId={id} />);
    expect(await screen.findByText('This role does not see the report.')).toBeTruthy();
    first.unmount();

    mockApi({ [`GET ${reportPath}`]: () => apiError(404, 'NOT_FOUND') });
    withQuery(<ReportScreen assessmentId={id} />);
    expect(await screen.findByText('Report not found.')).toBeTruthy();
  });
});

describe('the candidate feedback on the API', () => {
  it('shows the notes, with no digit and no decision word', async () => {
    mockApi({ [`GET ${reportPath}/candidate-feedback`]: () => json(feedback) });
    const { container } = withQuery(<FeedbackScreen assessmentId={id} />);
    expect(await screen.findByText(feedback.strengths[0])).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.textContent).not.toMatch(/\b(score|rank|admit|reject|accept|pass|fail)\w*/i);
  });

  it('says it is not ready yet while the API has none', async () => {
    mockApi({ [`GET ${reportPath}/candidate-feedback`]: () => apiError(404, 'NOT_FOUND') });
    withQuery(<FeedbackScreen assessmentId={id} />);
    expect(await screen.findByText('Your feedback is not ready yet')).toBeTruthy();
  });
});

describe('the way into the report', () => {
  const withAssessment = (assessmentState: { assessmentId: string | null; status: string } | null) => ({
    items: candidates.items.map((item) => ({ ...item, progress: { ...item.progress!, assessment: assessmentState } })),
  });
  const asRole = (role: DemoRole) =>
    withQuery(
      <DemoRoleProvider role={role}>
        <AssessmentGate audience="staff" />
      </DemoRoleProvider>,
    );

  it('opens the report as soon as it is ready', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(withAssessment({ assessmentId: id, status: 'ready' })) });
    asRole('commission');
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/commission/simulation-report/${id}`));
  });

  it('says the report is being prepared while the assessment runs', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(withAssessment({ assessmentId: id, status: 'pending' })) });
    asRole('commission');
    expect(await screen.findByText(/the assessment is running/)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('lets only the admin run a failed assessment again', async () => {
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(withAssessment({ assessmentId: 'failed-one', status: 'failed' })),
      'POST /api/v1/simulation-assessments': () => json({ ...assessment, assessmentId: 'second-try' }, 201),
    });
    const commission = asRole('commission');
    expect(await screen.findByText('The assessment could not be made')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run the assessment again' })).toBeNull();
    commission.unmount();

    asRole('admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Run the assessment again' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/commission/simulation-report/second-try'));
    const sent = calls.find((call) => call.method === 'POST')!;
    expect(JSON.parse(sent.body as string)).toEqual({ simulationId: candidates.items[0].progress!.simulation!.simulationId });
    expect(sent.headers.get('idempotency-key')).toBeTruthy();
  });

  it('keeps the report from the interviewer, who scores blind', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(withAssessment(null)) });
    asRole('interviewer');
    expect(await screen.findByText('This role does not see the report.')).toBeTruthy();
  });
});
