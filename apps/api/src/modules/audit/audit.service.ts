import { Injectable } from '@nestjs/common';
import { ApiRole, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface AuditInput {
  action: string;
  targetType: string;
  targetId?: string;
  candidateId?: string;
  actorRole?: ApiRole;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditInput) {
    return this.prisma.auditEvent.create({
      data: { ...input, metadata: this.safeMetadata(input.metadata) },
    });
  }

  private safeMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
    if (!metadata) return undefined;
    const blocked = /key|token|secret|profile|email|phone|iin|name/i;
    return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.test(key))) as Prisma.InputJsonValue;
  }
}
