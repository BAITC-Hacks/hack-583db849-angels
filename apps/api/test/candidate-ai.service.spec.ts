import { CandidateAiService } from '../src/ai-client/candidate-ai.service';
import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

describe('CandidateAiService', () => {
  it('sends only the LLM view to the gateway port', async () => {
    const brief = jest.fn().mockResolvedValue({});
    const service = new CandidateAiService(new ToLlmViewService(), {
      brief, scenarios: jest.fn(), simulationTurn: jest.fn(), transcribeTurn: jest.fn(), speech: jest.fn(),
      simulationAssessment: jest.fn(),
    });
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
});
