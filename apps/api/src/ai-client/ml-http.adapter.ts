import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import createClient from 'openapi-fetch';

import { AiGateway } from './ai-gateway.port';
import type { paths } from './schema';
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
}
