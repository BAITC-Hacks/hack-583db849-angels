import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class IdempotencyService {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(key: string | undefined, body: unknown, create: () => Promise<T>, statusCode = 201): Promise<T> {
    if (!key) return create();
    const pending = this.inFlight.get(key);
    if (pending) {
      try { await pending; } catch { /* A failed request leaves no cached response; retry it. */ }
      return this.execute(key, body, create, statusCode);
    }
    const operation = this.executeOnce(key, body, create, statusCode);
    this.inFlight.set(key, operation);
    try { return await operation; }
    finally { this.inFlight.delete(key); }
  }

  private async executeOnce<T>(key: string, body: unknown, create: () => Promise<T>, statusCode: number): Promise<T> {
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
        statusCode,
        response: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return response;
  }
}
