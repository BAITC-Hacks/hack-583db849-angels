import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApiRole } from '../../auth/roles';
import { PrismaService } from '../../database/prisma.service';
import { CreateCandidateDto } from './create-candidate.dto';
import { CandidateDto, CandidateProgressDto } from './dto/candidate.dto';
import { filterProgressForRole } from './filter-progress-for-role';

const candidateSelect = { id: true, externalId: true, label: true, createdAt: true } as const;
const candidateWithSimulationSelect = {
  ...candidateSelect,
  simulations: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true, status: true },
  },
} as const satisfies Prisma.CandidateSelect;

type SafeCandidate = Prisma.CandidateGetPayload<{ select: typeof candidateSelect }>;
type CandidateWithSimulation = Prisma.CandidateGetPayload<{ select: typeof candidateWithSimulationSelect }>;

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: CreateCandidateDto, demoLabel?: string): Promise<CandidateDto> {
    const profile = input.profile as unknown as Prisma.InputJsonValue;
    const application = input.application as unknown as Prisma.InputJsonValue;
    const test = input.test as unknown as Prisma.InputJsonValue;
    const englishCertificate = input.englishCertificate === null
      ? Prisma.DbNull
      : input.englishCertificate as Prisma.InputJsonValue | undefined;
    const label = demoLabel ?? `Candidate ${input.externalId.slice(-4).toUpperCase()}`;
    const candidate = await this.prisma.candidate.upsert({
      where: { externalId: input.externalId },
      create: { externalId: input.externalId, label, profile, application, test, englishCertificate },
      update: { label, profile, application, test, englishCertificate },
      select: candidateSelect,
    });
    return this.toDto(candidate);
  }

  async list(includeProgress: boolean, role: ApiRole): Promise<{ items: CandidateDto[] }> {
    if (includeProgress) {
      const candidates = await this.prisma.candidate.findMany({
        orderBy: { createdAt: 'asc' },
        select: candidateWithSimulationSelect,
      });
      return { items: candidates.map((candidate) => ({
        ...this.toDto(candidate),
        progress: this.toProgress(candidate, role),
      })) };
    }
    const candidates = await this.prisma.candidate.findMany({ orderBy: { createdAt: 'asc' }, select: candidateSelect });
    return { items: candidates.map((candidate) => this.toDto(candidate)) };
  }

  async find(id: string): Promise<CandidateDto | null> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id }, select: candidateSelect });
    return candidate ? this.toDto(candidate) : null;
  }

  async progress(id: string, role: ApiRole): Promise<CandidateProgressDto | null> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id }, select: candidateWithSimulationSelect });
    return candidate ? this.toProgress(candidate, role) : null;
  }

  private toDto(candidate: SafeCandidate): CandidateDto {
    return {
      candidateId: candidate.id,
      externalId: candidate.externalId,
      label: candidate.label,
      createdAt: candidate.createdAt.toISOString(),
    };
  }

  private toProgress(candidate: CandidateWithSimulation, role: ApiRole): CandidateProgressDto {
    const simulation = candidate.simulations[0];
    const progress: CandidateProgressDto = {
      candidateId: candidate.id,
      label: candidate.label,
      brief: null,
      simulation: simulation ? {
        simulationId: simulation.id,
        status: simulation.status,
        ending: null,
      } : null,
      assessment: null,
      interview: null,
      surprise: null,
      consistency: { before: null, after: null },
    };
    return filterProgressForRole(progress, role);
  }
}
