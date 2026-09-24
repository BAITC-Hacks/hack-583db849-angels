import { Injectable } from '@nestjs/common';

export interface CandidateSnapshot {
  externalId: string;
  profile: Record<string, unknown>;
  application: { answers: { fieldId: string; question: string; answer: string }[] };
  test: { answers: { itemId: string; response: string }[] };
  englishCertificate?: { type: string; score: string };
}

export interface LlmView {
  candidateId: string;
  application: CandidateSnapshot['application'];
  test: CandidateSnapshot['test'];
  englishCertificate?: { type: string; score: string };
}

@Injectable()
export class ToLlmViewService {
  toLlmView(candidateId: string, snapshot: CandidateSnapshot): LlmView {
    return {
      candidateId,
      application: { answers: snapshot.application.answers.map((answer) => ({ ...answer, answer: this.redactText(snapshot.profile, answer.answer) })) },
      test: { answers: snapshot.test.answers.map((answer) => ({ ...answer, response: this.redactText(snapshot.profile, answer.response) })) },
      ...(snapshot.englishCertificate ? { englishCertificate: snapshot.englishCertificate } : {}),
    };
  }

  redactText(profile: Record<string, unknown>, text: string): string {
    const values = Object.values(profile)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .sort((left, right) => right.length - left.length);
    return values.reduce((result, value) => result.split(value).join('[redacted]'), text);
  }
}
