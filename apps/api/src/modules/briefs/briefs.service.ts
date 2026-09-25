import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { CandidateAiService } from '../../ai-client/candidate-ai.service';
import type { components } from '../../ai-client/schema';
import { PrismaService } from '../../database/prisma.service';
import { CandidateSnapshot, LlmView, ToLlmViewService } from '../../privacy/to-llm-view.service';
import { BriefDto } from './dto/brief.dto';

type BriefResult = components['schemas']['BriefResult'];
type EnglishMetrics = components['schemas']['EnglishMetrics'];
type Evidence = components['schemas']['Evidence'];

const candidateSelect = {
  id: true, externalId: true, profile: true, application: true, test: true, englishCertificate: true,
} as const satisfies Prisma.CandidateSelect;
type BriefCandidate = Prisma.CandidateGetPayload<{ select: typeof candidateSelect }>;

/** The seeded demo candidates, by externalId, and where their expected brief lives. */
const seedLetters: Record<string, string> = { 'inv-2026-demo-a': 'a', 'inv-2026-demo-b': 'b', 'inv-2026-demo-c': 'c' };

@Injectable()
export class BriefsService {
  private readonly logger = new Logger(BriefsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly candidateAi: CandidateAiService,
    private readonly privacy: ToLlmViewService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Makes a brief for the candidate without anyone asking: when they arrive,
   * and again with the simulation's English once it is assessed. It never
   * throws — a failure is kept as `failed`, and `progress.brief` shows it.
   */
  async startFor(candidateId: string, simulationEnglish?: EnglishMetrics | null): Promise<void> {
    try {
      await this.generate(candidateId, simulationEnglish, { reuseSeed: true });
    } catch (error) {
      this.logger.error(`Automatic brief failed for candidate ${candidateId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** An admin's re-run: a new brief now, or the ML error as it came. */
  async rerun(candidateId: string): Promise<BriefDto> {
    const briefId = await this.generate(candidateId, await this.latestSimulationEnglish(candidateId), { reuseSeed: false, rethrow: true });
    return this.get(briefId);
  }

  async get(briefId: string): Promise<BriefDto> {
    const brief = await this.prisma.brief.findUnique({ where: { id: briefId }, include: { candidate: { select: candidateSelect } } });
    if (!brief || brief.status !== 'ready' || !brief.result) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Brief was not found.' });
    }
    return this.toDto(brief.id, brief.createdAt, brief.result as unknown as BriefResult, brief.candidate);
  }

  /** The latest ready brief — what the interviewer's screen opens. */
  async latestFor(candidateId: string): Promise<BriefDto> {
    const brief = await this.prisma.brief.findFirst({
      where: { candidateId, status: 'ready' },
      orderBy: { createdAt: 'desc' },
      include: { candidate: { select: candidateSelect } },
    });
    if (!brief?.result) throw new NotFoundException({ code: 'BRIEF_NOT_FOUND', message: 'There is no brief for this candidate yet.' });
    return this.toDto(brief.id, brief.createdAt, brief.result as unknown as BriefResult, brief.candidate);
  }

  private async generate(
    candidateId: string,
    simulationEnglish: EnglishMetrics | null | undefined,
    { reuseSeed, rethrow = false }: { reuseSeed: boolean; rethrow?: boolean },
  ): Promise<string> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: candidateSelect });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });

    const seeded = await this.seedBrief(candidate.externalId);
    if (seeded && reuseSeed) {
      // The demo candidates' brief is the seed's, and it does not change: one is enough.
      const existing = await this.prisma.brief.findFirst({ where: { candidateId, status: 'ready' }, select: { id: true } });
      if (existing) return existing.id;
    }

    const pending = await this.prisma.brief.create({ data: { candidateId, status: 'pending' }, select: { id: true } });
    try {
      const result = seeded ?? await this.candidateAi.brief(candidateId, this.snapshot(candidate), simulationEnglish);
      await this.prisma.brief.update({
        where: { id: pending.id },
        data: { status: 'ready', result: result as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      await this.prisma.brief.update({ where: { id: pending.id }, data: { status: 'failed' } });
      if (rethrow) throw error;
      this.logger.error(`Brief ${pending.id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return pending.id;
  }

  /** In DEMO_MODE, A, B and C get the brief from `seed/`: it is what the demo shows. */
  private async seedBrief(externalId: string): Promise<BriefResult | null> {
    const letter = seedLetters[externalId];
    if (!letter || this.config.get<string>('DEMO_MODE') !== 'true') return null;
    const filename = resolve(process.cwd(), '../../seed/candidates', letter, 'expected-brief.json');
    return JSON.parse(await readFile(filename, 'utf8')) as BriefResult;
  }

  private async latestSimulationEnglish(candidateId: string): Promise<EnglishMetrics | null> {
    const assessment = await this.prisma.assessment.findFirst({
      where: { candidateId, status: 'ready' },
      orderBy: { createdAt: 'desc' },
      select: { result: true },
    });
    return (assessment?.result as { english?: EnglishMetrics } | null)?.english ?? null;
  }

  private snapshot(candidate: BriefCandidate): CandidateSnapshot {
    return {
      externalId: candidate.externalId,
      profile: candidate.profile as Record<string, unknown>,
      application: candidate.application as unknown as CandidateSnapshot['application'],
      test: candidate.test as unknown as CandidateSnapshot['test'],
      ...(candidate.englishCertificate ? { englishCertificate: candidate.englishCertificate as unknown as CandidateSnapshot['englishCertificate'] } : {}),
    };
  }

  /**
   * The brief as the contract has it. `sources` are the answers the quotes
   * point into, taken from the same redacted view the model read, so every
   * quote is found in them word for word — and no profile field is among them.
   */
  private toDto(briefId: string, createdAt: Date, result: BriefResult, candidate: BriefCandidate): BriefDto {
    const view: LlmView = this.privacy.toLlmView(candidate.id, this.snapshot(candidate));
    const cited = [
      ...result.questions.flatMap((question) => question.evidence),
      ...result.consistency.flatMap((item) => [...item.claim.evidence, ...item.observation.evidence]),
      ...result.clarify.flatMap((topic) => topic.evidence),
    ];
    const ids = (source: Evidence['source']) => new Set(cited.filter((evidence) => evidence.source === source).map((evidence) => evidence.sourceId));
    const fields = ids('application_field');
    const items = ids('test_item');

    return {
      briefId,
      candidateId: candidate.id,
      createdAt: createdAt.toISOString(),
      summary: result.summary,
      questions: result.questions as BriefDto['questions'],
      consistency: result.consistency as BriefDto['consistency'],
      clarify: result.clarify as BriefDto['clarify'],
      english: result.english as BriefDto['english'],
      sources: {
        application: view.application.answers.filter((answer) => fields.has(answer.fieldId)),
        test: view.test.answers.filter((answer) => items.has(answer.itemId)),
        // The surprise answer joins the brief with #55.
        surpriseAnswer: null,
      },
    };
  }
}
