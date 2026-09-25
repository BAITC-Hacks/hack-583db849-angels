import { ConfigService } from '@nestjs/config';

import { MlHttpAdapter } from '../src/ai-client/ml-http.adapter';

describe('MlHttpAdapter', () => {
  const config = {
    get: jest.fn().mockReturnValue('http://ml:8000'),
    getOrThrow: jest.fn().mockReturnValue('internal-token'),
  } as unknown as ConfigService;

  it('uses generated request types and sends the internal token', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ summary: '', questions: [], consistency: [], clarify: [], english: { certificate: null, writtenCefr: '', basis: '' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const adapter = new MlHttpAdapter(config, fetchImplementation);

    await expect(adapter.brief({
      candidate: { candidateId: 'candidate-id', application: { answers: [] }, test: { answers: [] } },
    })).resolves.toMatchObject({ summary: '' });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [request] = fetchImplementation.mock.calls[0] as [Request];
    expect(request.url).toBe('http://ml:8000/internal/v1/brief');
    expect(request.headers.get('X-Internal-Token')).toBe('internal-token');
    await expect(request.clone().json()).resolves.toEqual({
      candidate: { candidateId: 'candidate-id', application: { answers: [] }, test: { answers: [] } },
    });
  });

  it('sends scenarioId for character speech and returns the MP3 bytes', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(new Response(Buffer.from('mp3'), {
      status: 200, headers: { 'Content-Type': 'audio/mpeg' },
    }));
    const adapter = new MlHttpAdapter(config, fetchImplementation);
    await expect(adapter.speech('Hello', 'conflict-resolution')).resolves.toEqual(Buffer.from('mp3'));
    const [request] = fetchImplementation.mock.calls[0] as [Request];
    await expect(request.clone().json()).resolves.toEqual({ text: 'Hello', scenarioId: 'conflict-resolution' });
  });

  it('transcribes a relative upload reference as a single candidate turn', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      turns: [{ speaker: 'candidate', text: 'Synthetic answer', startSec: 0, endSec: 1, confidence: 0.8 }],
      durationSec: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const adapter = new MlHttpAdapter(config, fetchImplementation);
    await adapter.transcribeTurn('turns/sim-id/audio.webm');
    const [request] = fetchImplementation.mock.calls[0] as [Request];
    await expect(request.clone().json()).resolves.toMatchObject({
      purpose: 'turn', speakers: 1, audioRef: 'turns/sim-id/audio.webm',
    });
  });

  it('passes a budget error from the binary speech endpoint through unchanged', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'AI_BUDGET_EXCEEDED', message: 'Synthetic budget', details: {}, traceId: 'ml-trace' },
    }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    const adapter = new MlHttpAdapter(config, fetchImplementation);
    await expect(adapter.speech('Hello', 'conflict-resolution')).rejects.toMatchObject({
      status: 503, response: { code: 'AI_BUDGET_EXCEEDED' },
    });
  });

  it.each([
    [503, 'AI_BUDGET_EXCEEDED', 503, 'AI_BUDGET_EXCEEDED'],
    [503, 'AI_UNAVAILABLE', 503, 'AI_UNAVAILABLE'],
    [502, 'AI_INVALID_OUTPUT', 502, 'AI_INVALID_OUTPUT'],
    [404, 'AUDIO_NOT_FOUND', 503, 'AI_UNAVAILABLE'],
    [401, 'UNAUTHORIZED', 503, 'AI_UNAVAILABLE'],
    [422, 'VALIDATION_ERROR', 500, 'INTERNAL_ERROR'],
    [400, 'INVALID_AUDIO_REF', 500, 'INTERNAL_ERROR'],
    [404, 'SCENARIO_NOT_FOUND', 500, 'INTERNAL_ERROR'],
    [500, 'INTERNAL_ERROR', 503, 'AI_UNAVAILABLE'],
  ])('maps ML %s %s to API %s %s', async (status, code, expectedStatus, expectedCode) => {
    const fetchImplementation = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code, message: 'Synthetic ML failure', details: {}, traceId: 'ml-trace' },
    }), { status, headers: { 'Content-Type': 'application/json' } }));
    const adapter = new MlHttpAdapter(config, fetchImplementation);
    await expect(adapter.transcribeTurn('turns/example.webm')).rejects.toMatchObject({
      status: expectedStatus, response: { code: expectedCode },
    });
  });
  it('posts the full assessment request to ML and returns its result', async () => {
    const result = { scores: [], english: {}, interviewQuestions: [],
      candidateFeedback: { strengths: [], growth: [], nextTime: [] } };
    const fetchImplementation = jest.fn().mockResolvedValue(new Response(JSON.stringify(result), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const adapter = new MlHttpAdapter(config, fetchImplementation);
    const body = {
      candidateId: 'synthetic-id', scenarioId: 'conflict-resolution', mode: 'voice' as const,
      turns: [{ turnId: 'turn_01', speaker: 'candidate' as const, text: 'Synthetic answer',
        startedAt: '2026-09-25T10:05:00Z', endedAt: '2026-09-25T10:05:20Z' }],
    };
    await expect(adapter.simulationAssessment(body)).resolves.toEqual(result);
    const [request] = fetchImplementation.mock.calls[0] as [Request];
    expect(request.url).toBe('http://ml:8000/internal/v1/simulation/assessment');
    await expect(request.clone().json()).resolves.toEqual(body);
  });

});
