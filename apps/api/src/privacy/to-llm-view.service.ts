import { Injectable } from '@nestjs/common';

export interface CandidateSnapshot {
  externalId: string;
  profile: Record<string, unknown>;
  application: { answers: { fieldId: string; question: string; answer: string }[] };
  test: { answers: { itemId: string; response: string }[] };
  englishCertificate?: Record<string, unknown>;
}

export interface LlmView {
  candidateId: string;
  application: CandidateSnapshot['application'];
  test: CandidateSnapshot['test'];
  englishCertificate?: Record<string, unknown>;
}

@Injectable()
export class ToLlmViewService {
  toLlmView(candidateId: string, snapshot: CandidateSnapshot): LlmView {
    const values = Object.values(snapshot.profile)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .sort((left, right) => right.length - left.length);
    const redact = (text: string): string => values.reduce((result, value) => result.split(value).join('[redacted]'), text);
    return {
      candidateId,
      application: { answers: snapshot.application.answers.map((answer) => ({ ...answer, answer: redact(answer.answer) })) },
      test: { answers: snapshot.test.answers.map((answer) => ({ ...answer, response: redact(answer.response) })) },
      ...(snapshot.englishCertificate ? { englishCertificate: snapshot.englishCertificate } : {}),
    };
  }
}
