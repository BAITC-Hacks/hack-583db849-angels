import { ToLlmViewService } from '../src/privacy/to-llm-view.service';

describe('ToLlmViewService', () => {
  it('removes profile and redacts profile values embedded in answers', () => {
    const result = new ToLlmViewService().toLlmView('candidate-id', {
      externalId: 'external-id',
      profile: { fullName: 'Ada Example', email: 'ada@example.test', iin: '123456789012', phone: '+70000000000', region: 'Almaty' },
      application: { answers: [{ fieldId: 'motivation', question: 'Why?', answer: 'Ada Example can be reached at ada@example.test.' }] },
      test: { answers: [{ itemId: 'one', response: 'My IIN is 123456789012.' }] },
    });
    expect(result).toEqual({
      candidateId: 'candidate-id',
      application: { answers: [{ fieldId: 'motivation', question: 'Why?', answer: '[redacted] can be reached at [redacted].' }] },
      test: { answers: [{ itemId: 'one', response: 'My IIN is [redacted].' }] },
    });
    expect(JSON.stringify(result)).not.toContain('external-id');
    expect(JSON.stringify(result)).not.toContain('Almaty');
  });
});
