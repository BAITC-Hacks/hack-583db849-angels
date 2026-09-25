import { CandidateAiService } from '../src/ai-client/candidate-ai.service';
import { AiGateway } from '../src/ai-client/ai-gateway.port';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

/** Every gateway method as a mock; a test overrides the one it watches. */
function gateway(overrides: Partial<Record<keyof AiGateway, jest.Mock>>): AiGateway {
  const methods: (keyof AiGateway)[] = [
    'brief', 'scenarios', 'simulationTurn', 'simulationAssessment', 'transcribeTurn', 'speech',
    'surpriseQuestion', 'transcribeSurprise', 'qualityCheck', 'transcribeInterview', 'interviewDraft', 'consistency', 'usage',
  ];
  return { ...Object.fromEntries(methods.map((method) => [method, jest.fn()])), ...overrides } as unknown as AiGateway;
}

describe('CandidateAiService', () => {
  it('sends only the LLM view to the gateway port', async () => {
    const brief = jest.fn().mockResolvedValue({});
    const service = new CandidateAiService(new ToLlmViewService(), gateway({ brief }));
    await service.brief('candidate-id', {
      externalId: 'external-id',
      profile: { fullName: 'Ada Example', email: 'ada@example.test' },
      application: { answers: [{ fieldId: 'motivation', question: 'Why?', answer: 'Ada Example' }] },
      test: { answers: [] },
    });
    const payload = brief.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ candidate: { candidateId: 'candidate-id' } });
    expect(payload).not.toHaveProperty('simulationEnglish');
    expect(JSON.stringify(payload)).not.toContain('profile');
    expect(JSON.stringify(payload)).not.toContain('Ada Example');
    expect(JSON.stringify(payload)).not.toContain('external-id');
  });

  it('writes the surprise question from the LLM view only', async () => {
    const surpriseQuestion = jest.fn().mockResolvedValue({ question: 'Q?', competency: 'D', why: 'Because.' });
    const service = new CandidateAiService(new ToLlmViewService(), gateway({ surpriseQuestion }));
    await service.surpriseQuestion('candidate-id', {
      externalId: 'external-id',
      profile: { fullName: 'Ada Example', email: 'ada@example.test' },
      application: { answers: [{ fieldId: 'setback', question: 'What went wrong?', answer: 'Ada Example fixed it.' }] },
      test: { answers: [] },
    });
    const payload = JSON.stringify(surpriseQuestion.mock.calls[0][0]);
    expect(surpriseQuestion.mock.calls[0][0]).toMatchObject({ candidate: { candidateId: 'candidate-id' } });
    expect(payload).not.toMatch(/profile|Ada Example|ada@example\.test|external-id/);
  });
});
