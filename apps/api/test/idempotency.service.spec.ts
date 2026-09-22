import { IdempotencyService } from '../src/idempotency/idempotency.service';

describe('IdempotencyService', () => {
  const response = { candidateId: 'candidate-a' };

  it('returns the first response for the same key and body', async () => {
    const store = new Map<string, { requestHash: string; response: unknown }>();
    const prisma = {
      idempotencyKey: {
        findUnique: jest.fn(async ({ where: { key } }) => store.get(key) ?? null),
        create: jest.fn(async ({ data }) => {
          store.set(data.key, { requestHash: data.requestHash, response: data.response });
          return data;
        }),
      },
    };
    const service = new IdempotencyService(prisma as never);
    const create = jest.fn(async () => response);

    await expect(service.execute('same-key', { externalId: 'a' }, create)).resolves.toEqual(response);
    await expect(service.execute('same-key', { externalId: 'a' }, create)).resolves.toEqual(response);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a reused key with a different body', async () => {
    const prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue({ requestHash: 'different', response }),
      },
    };
    const service = new IdempotencyService(prisma as never);
    await expect(service.execute('same-key', { externalId: 'a' }, async () => response)).rejects.toMatchObject({ status: 409 });
  });
});
