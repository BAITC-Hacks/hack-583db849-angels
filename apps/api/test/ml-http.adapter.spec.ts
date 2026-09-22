import { ConfigService } from '@nestjs/config';

import { MlHttpAdapter } from '../src/ai-client/ml-http.adapter';

describe('MlHttpAdapter', () => {
  it('uses generated request types and sends the internal token', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ summary: '', questions: [], flags: [], clarify: [], english: { certificate: null, writtenCefr: '', basis: '' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const config = {
      get: jest.fn().mockReturnValue('http://ml:8000'),
      getOrThrow: jest.fn().mockReturnValue('internal-token'),
    } as unknown as ConfigService;
    const adapter = new MlHttpAdapter(config, fetchImplementation);

    await adapter.sendCandidateContext({
      candidateId: 'candidate-id',
      application: { answers: [] },
      test: { answers: [] },
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [request] = fetchImplementation.mock.calls[0] as [Request];
    expect(request.url).toBe('http://ml:8000/internal/v1/brief');
    expect(request.headers.get('X-Internal-Token')).toBe('internal-token');
    await expect(request.clone().json()).resolves.toEqual({
      candidate: { candidateId: 'candidate-id', application: { answers: [] }, test: { answers: [] } },
    });
  });
});
