import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import createClient from 'openapi-fetch';

import { AiGateway } from './ai-gateway.port';
import type { components, paths } from './schema';
import { LlmView } from '../privacy/to-llm-view.service';

export const ML_FETCH = Symbol('ML_FETCH');

@Injectable()
export class MlHttpAdapter implements AiGateway {
  constructor(
    private readonly config: ConfigService,
    @Inject(ML_FETCH) private readonly fetchImplementation: typeof globalThis.fetch,
  ) {}

  async sendCandidateContext(view: LlmView): Promise<void> {
    const client = createClient<paths>({
      baseUrl: this.config.get<string>('ML_SERVICE_URL', 'http://localhost:8000'),
      headers: { 'X-Internal-Token': this.config.getOrThrow<string>('ML_INTERNAL_TOKEN') },
      fetch: this.fetchImplementation,
    });
    const { error } = await client.POST('/internal/v1/brief', { body: { candidate: view } });
    if (error) {
      throw new ServiceUnavailableException({ code: 'ML_REQUEST_FAILED', message: 'The ML service rejected the request.' });
    }
  }

  async scenarios(): Promise<components['schemas']['ScenarioBrief'][]> {
    const client = createClient<paths>({
      baseUrl: this.config.get<string>('ML_SERVICE_URL', 'http://localhost:8000'),
      headers: { 'X-Internal-Token': this.config.getOrThrow<string>('ML_INTERNAL_TOKEN') },
      fetch: this.fetchImplementation,
    });
    const { data, error } = await client.GET('/internal/v1/scenarios');
    if (error || !data) {
      throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE', message: 'The ML service did not return scenarios.' });
    }
    return data;
  }
}
