import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import createClient from 'openapi-fetch';

import { AiGateway } from './ai-gateway.port';
import type { components, paths } from './schema';

export const ML_FETCH = Symbol('ML_FETCH');

type MlClient = ReturnType<typeof createClient<paths>>;

@Injectable()
export class MlHttpAdapter implements AiGateway {
  private readonly logger = new Logger(MlHttpAdapter.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(ML_FETCH) private readonly fetchImplementation: typeof globalThis.fetch,
  ) {}

  brief(request: components['schemas']['BriefRequest']): Promise<components['schemas']['BriefResult']> {
    return this.invoke('brief', () => this.client().POST('/internal/v1/brief', { body: request }));
  }

  scenarios(): Promise<components['schemas']['ScenarioBrief'][]> {
    return this.invoke('scenarios', () => this.client().GET('/internal/v1/scenarios'));
  }

  simulationTurn(request: components['schemas']['TurnRequest']): Promise<components['schemas']['TurnResult']> {
    return this.invoke('simulation/turn', () => this.client().POST('/internal/v1/simulation/turn', { body: request }));
  }

  simulationAssessment(request: components['schemas']['AssessmentRequest']): Promise<components['schemas']['AssessmentResult']> {
    return this.invoke('simulation/assessment', () => this.client().POST('/internal/v1/simulation/assessment', { body: request }));
  }

  transcribeTurn(audioRef: string): Promise<components['schemas']['TranscribeResult']> {
    return this.invoke('transcribe', () => this.client().POST('/internal/v1/transcribe', {
      body: { purpose: 'turn', audioRef, language: 'en', speakers: 1 },
    }));
  }

  surpriseQuestion(request: components['schemas']['SurpriseRequest']): Promise<components['schemas']['SurpriseResult']> {
    return this.invoke('surprise-question', () => this.client().POST('/internal/v1/surprise-question', { body: request }));
  }

  transcribeSurprise(audioRef: string): Promise<components['schemas']['TranscribeResult']> {
    return this.invoke('transcribe', () => this.client().POST('/internal/v1/transcribe', {
      body: { purpose: 'surprise', audioRef, language: 'en', speakers: 1 },
    }));
  }

  async speech(text: string, scenarioId: string): Promise<Buffer> {
    const data = await this.invoke('speech', () => this.client().POST('/internal/v1/speech', {
      body: { text, scenarioId }, parseAs: 'arrayBuffer',
    }));
    return Buffer.from(data as ArrayBuffer);
  }

  private client(): MlClient {
    return createClient<paths>({
      baseUrl: this.config.get<string>('ML_SERVICE_URL', 'http://localhost:8000'),
      headers: { 'X-Internal-Token': this.config.getOrThrow<string>('ML_INTERNAL_TOKEN') },
      fetch: this.fetchImplementation,
    });
  }

  private async invoke<T>(operation: string, call: () => Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
    let result: { data?: T; error?: unknown; response: Response };
    try {
      result = await call();
    } catch {
      this.logger.error(`ML ${operation} did not answer`);
      throw new HttpException({ code: 'AI_UNAVAILABLE', message: 'The ML service is unavailable.' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (result.error !== undefined || result.data === undefined) {
      this.fail(operation, result.response.status, result.error);
    }
    return result.data;
  }

  private fail(operation: string, status: number, error: unknown): never {
    let payload: unknown = error;
    if (error instanceof ArrayBuffer) {
      try { payload = JSON.parse(new TextDecoder().decode(error)) as unknown; } catch { payload = {}; }
    }
    const envelope = this.record(payload)?.error;
    const body = this.record(envelope);
    const code = typeof body?.code === 'string' ? body.code : undefined;
    const traceId = typeof body?.traceId === 'string' ? body.traceId : 'missing';
    this.logger.error(`ML ${operation} failed: status=${status} code=${code ?? 'unknown'} traceId=${traceId}`);

    if (code === 'AI_INVALID_OUTPUT' && status === 502) {
      throw new HttpException({ code, message: 'The ML service returned invalid output.' }, HttpStatus.BAD_GATEWAY);
    }
    if ((code === 'AI_UNAVAILABLE' || code === 'AI_BUDGET_EXCEEDED') && status === 503) {
      throw new HttpException({ code, message: 'The ML service is unavailable.' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if ((status === 422 && code === 'VALIDATION_ERROR') || (status === 400 && code === 'INVALID_AUDIO_REF') ||
        (status === 404 && code === 'SCENARIO_NOT_FOUND')) {
      throw new HttpException({ code: 'INTERNAL_ERROR', message: 'The ML request was invalid.' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    throw new HttpException({ code: 'AI_UNAVAILABLE', message: 'The ML service is unavailable.' }, HttpStatus.SERVICE_UNAVAILABLE);
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }
}
