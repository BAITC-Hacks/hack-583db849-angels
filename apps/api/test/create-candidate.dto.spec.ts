import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCandidateDto } from '../src/modules/candidates/create-candidate.dto';

describe('CreateCandidateDto', () => {
  it('accepts the nested candidate snapshot contract', async () => {
    const candidate = plainToInstance(CreateCandidateDto, {
      externalId: 'candidate-a',
      profile: { name: 'Synthetic Candidate' },
      application: {
        answers: [{ fieldId: 'motivation', question: 'Why?', answer: 'I led a synthetic project.' }],
      },
      test: {
        answers: [{ itemId: 'item-1', response: 'Synthetic response' }],
      },
    });

    await expect(validate(candidate, { whitelist: true, forbidNonWhitelisted: true })).resolves.toEqual([]);
  });

  it('validates every nested answer', async () => {
    const candidate = plainToInstance(CreateCandidateDto, {
      externalId: 'candidate-a',
      profile: {},
      application: { answers: [{ fieldId: 'motivation', question: 'Why?' }] },
      test: { answers: [] },
    });

    const errors = await validate(candidate, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((error) => error.property === 'application')).toBe(true);
  });
});
