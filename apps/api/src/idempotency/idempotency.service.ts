import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(key: string | undefined, body: unknown, create: () => Promise<T>): Promise<T> {
    if (!key) return create();
    const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency-Key was already used with a different request.' });
      }
      return existing.response as unknown as T;
    }
    const response = await create();
    await this.prisma.idempotencyKey.create({
      data: {
        key,
        requestHash,
        statusCode: 201,
        response: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return response;
  }
}
