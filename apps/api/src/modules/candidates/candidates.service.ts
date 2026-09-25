import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApiRole } from '../../auth/roles';
import { BriefsService } from '../briefs/briefs.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateCandidateDto } from './create-candidate.dto';
import { CandidateDto, CandidateProgressDto } from './dto/candidate.dto';
import { filterProgressForRole } from './filter-progress-for-role';
import { surpriseStatus } from '../surprise/surprise-status';

const candidateSelect = { id: true, externalId: true, label: true, createdAt: true } as const;
const candidateWithSimulationSelect = {
  ...candidateSelect,
  simulations: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true, status: true, ending: true },
  },
  assessments: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true, status: true },
  },
  accommodation: { select: { textMode: true, reason: true } },
  briefs: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true } },
  surprise: { select: { id: true, status: true, answerDeadline: true } },
  presentation: { select: { id: true, status: true } },
  interviews: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true, transcriptStatus: true, interviewerScore: { select: { id: true } },
      drafts: { where: { status: 'ready' }, take: 1, select: { id: true } },
    },
  },
  consistencyReports: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
} as const satisfies Prisma.CandidateSelect;

type SafeCandidate = Prisma.CandidateGetPayload<{ select: typeof candidateSelect }>;
type CandidateWithSimulation = Prisma.CandidateGetPayload<{ select: typeof candidateWithSimulationSelect }>;

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService, private readonly briefs: BriefsService) {}

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
    // The brief is made as soon as the candidate is here; nobody has to ask for it (#12).
    void this.briefs.startFor(candidate.id);
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
    const assessment = candidate.assessments[0];
    const brief = candidate.briefs[0];
    const interview = candidate.interviews[0];
    const progress: CandidateProgressDto = {
      candidateId: candidate.id,
      label: candidate.label,
      brief: brief ? { briefId: brief.id, status: brief.status as 'pending' | 'ready' | 'failed' } : null,
      simulation: simulation ? {
        simulationId: simulation.id,
        status: simulation.status,
        ending: simulation.ending as 'completed' | 'stopped' | null,
      } : null,
      assessment: assessment ? { assessmentId: assessment.id, status: assessment.status as 'pending' | 'ready' | 'failed' } : null,
      interview: interview ? {
        interviewId: interview.id,
        transcriptStatus: interview.transcriptStatus as 'none' | 'transcribing' | 'ready' | 'failed',
        scoresSaved: Boolean(interview.interviewerScore),
        draftReady: interview.drafts.length > 0,
      } : null,
      surprise: candidate.surprise ? { surpriseId: candidate.surprise.id, status: surpriseStatus(candidate.surprise) } : null,
      presentation: candidate.presentation
        ? { presentationId: candidate.presentation.id, status: candidate.presentation.status as 'transcribing' | 'ready' | 'failed' }
        : null,
      consistency: {
        before: brief ? (brief.status as 'pending' | 'ready' | 'failed') : null,
        // The after stage reads the interview, so it stays locked until the interviewer has scored blind.
        after: !interview ? null : !interview.interviewerScore ? 'locked'
          : (candidate.consistencyReports[0]?.status as 'pending' | 'ready' | 'failed' | undefined) ?? null,
      },
      accommodation: candidate.accommodation
        ? { textMode: candidate.accommodation.textMode, reason: candidate.accommodation.reason }
        : null,
    };
    return filterProgressForRole(progress, role);
  }
}
