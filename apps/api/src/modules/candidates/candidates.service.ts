import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCandidateDto } from './create-candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}
  async upsert(input: CreateCandidateDto) {
    const profile = input.profile as unknown as Prisma.InputJsonValue;
    const application = input.application as unknown as Prisma.InputJsonValue;
    const test = input.test as unknown as Prisma.InputJsonValue;
    const englishCertificate = input.englishCertificate as unknown as Prisma.InputJsonValue | undefined;
    return this.prisma.candidate.upsert({
      where: { externalId: input.externalId },
      create: { externalId: input.externalId, profile, application, test, englishCertificate },
      update: { profile, application, test, englishCertificate },
    });
  }
  list() { return this.prisma.candidate.findMany({ orderBy: { createdAt: 'asc' } }); }
  find(id: string) { return this.prisma.candidate.findUnique({ where: { id } }); }
}
