import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import { ApiRole } from '../../auth/roles';
import { PrismaService } from '../../database/prisma.service';
import { readSeed, seedLetter } from '../../seed-files';
import { AuditService } from '../audit/audit.service';
import { CandidatesService } from '../candidates/candidates.service';
import { DemoSeedService } from '../candidates/demo-seed.service';
import { CandidateProgressDto } from '../candidates/dto/candidate.dto';
import { SimulationAssessmentsService } from '../simulation-assessments/simulation-assessments.service';

/** Everything recorded or uploaded during a demo, under UPLOADS_DIR. */
const UPLOAD_FOLDERS = ['surprise', 'interviews', 'character', 'turns'];

interface RecordedTurn {
  speaker: 'candidate' | 'character';
  text: string;
  startedAt: string;
  endedAt: string;
}

/**
 * The demo's own controls. Both exist only with `DEMO_MODE=true`; without it
 * they answer 404, as if they were not there.
 */
@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly audit: AuditService,
    private readonly candidates: CandidatesService,
    private readonly seed: DemoSeedService,
    private readonly assessments: SimulationAssessmentsService,
  ) {}

  /**
   * Starts the demo over: every simulation, assessment, interview, surprise
   * question, quality check and the recordings on disk go, and A, B and C
   * are seeded again. The audit log stays — it is the record of what happened.
   */
  async reset(role: ApiRole): Promise<void> {
    this.demoOnly();
    await this.prisma.$transaction([
      this.prisma.qualityCheck.deleteMany(),
      this.prisma.consistencyReport.deleteMany(),
      this.prisma.interviewDraft.deleteMany(),
      this.prisma.interviewerScore.deleteMany(),
      this.prisma.interview.deleteMany(),
      this.prisma.surpriseQuestion.deleteMany(),
      this.prisma.assessment.deleteMany(),
      this.prisma.simulationTurn.deleteMany(),
      this.prisma.simulation.deleteMany(),
      this.prisma.accommodation.deleteMany(),
    ]);
    const root = resolve(this.config.get<string>('UPLOADS_DIR', '/data/uploads'));
    await Promise.all(UPLOAD_FOLDERS.map((folder) => rm(resolve(root, folder), { recursive: true, force: true })));
    await this.audit.record({ action: 'demo.reset', targetType: 'demo', actorRole: role });
    await this.seed.seed();
  }

  /**
   * Completes a seed candidate's simulation from the seed's own transcript,
   * and starts its assessment — the way to show the report without playing
   * the whole conversation on stage.
   */
  async recordedSession(candidateId: string, role: ApiRole): Promise<CandidateProgressDto> {
    this.demoOnly();
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { id: true, externalId: true } });
    const letter = candidate ? seedLetter(candidate.externalId) : null;
    if (!candidate || !letter) throw new NotFoundException({ code: 'NOT_FOUND', message: 'There is no recorded session for this candidate.' });
    const existing = await this.prisma.simulation.findUnique({ where: { candidateId }, select: { id: true } });
    if (existing) {
      throw new ConflictException({ code: 'SIMULATION_EXISTS', message: 'This candidate already has a simulation.', details: { simulationId: existing.id } });
    }

    const [session, turns] = await Promise.all([
      readSeed<{ scenarioId: string }>('candidates', letter, 'm2a-session.json'),
      readSeed<RecordedTurn[]>('candidates', letter, 'transcript.json'),
    ]);
    const scenarios = await this.gateway.scenarios().catch(() => {
      throw new HttpException({ code: 'AI_UNAVAILABLE', message: 'The ML service is unavailable.' }, HttpStatus.SERVICE_UNAVAILABLE);
    });
    const found = scenarios.find((scenario) => scenario.scenarioId === session.scenarioId);
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND', message: 'The recorded scenario is not in the pool.' });
    const { status: _status, ...scenario } = found;
    void _status;

    let simulationId: string;
    try {
      ({ id: simulationId } = await this.prisma.simulation.create({
        data: {
          candidateId, scenarioId: scenario.scenarioId, scenario: scenario as Prisma.InputJsonValue, mode: 'voice',
          status: 'completed', stage: 'finished', ending: 'completed', completedAt: new Date(turns.at(-1)?.endedAt ?? Date.now()),
          turns: {
            create: turns.map((turn, index) => ({
              sequence: index + 1, speaker: turn.speaker, text: turn.text, startedAt: new Date(turn.startedAt), endedAt: new Date(turn.endedAt),
            })),
          },
        },
        select: { id: true },
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.simulation.findUnique({ where: { candidateId }, select: { id: true } });
        throw new ConflictException({ code: 'SIMULATION_EXISTS', message: 'This candidate already has a simulation.', details: { simulationId: winner?.id } });
      }
      throw error;
    }
    await this.audit.record({ action: 'simulation.completed', targetType: 'simulation', targetId: simulationId, candidateId, actorRole: role, metadata: { recorded: true } });
    await this.assessments.startAutomatically(simulationId);
    return (await this.candidates.progress(candidateId, role)) as CandidateProgressDto;
  }

  private demoOnly(): void {
    if (this.config.get<string>('DEMO_MODE') !== 'true') throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found.' });
  }
}
