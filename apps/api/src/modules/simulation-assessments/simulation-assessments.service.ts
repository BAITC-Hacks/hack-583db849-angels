import { ConflictException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import type { components } from '../../ai-client/schema';
import { BriefsService } from '../briefs/briefs.service';
import { PrismaService } from '../../database/prisma.service';
import { ToLlmViewService } from '../../privacy/to-llm-view.service';
import { AuditService } from '../audit/audit.service';
import { CandidateFeedbackDto, SimulationAssessmentDto } from './dto/simulation-assessment.dto';

const turnsInOrder = { orderBy: { sequence: 'asc' } } as const;
const simulationInclude = {
  turns: turnsInOrder,
  candidate: { select: { profile: true } },
} as const satisfies Prisma.SimulationInclude;
const assessmentInclude = {
  candidate: { select: { label: true } },
  simulation: { include: { turns: turnsInOrder } },
} as const satisfies Prisma.AssessmentInclude;

type SimulationForAssessment = Prisma.SimulationGetPayload<{ include: typeof simulationInclude }>;
type StoredAssessment = Prisma.AssessmentGetPayload<{ include: typeof assessmentInclude }>;
type AssessmentResult = components['schemas']['AssessmentResult'];

@Injectable()
export class SimulationAssessmentsService {
  private readonly logger = new Logger(SimulationAssessmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly privacy: ToLlmViewService,
    private readonly audit: AuditService,
    private readonly briefs: BriefsService,
  ) {}

  async startAutomatically(simulationId: string): Promise<void> {
    const simulation = await this.loadSimulation(simulationId);
    if (simulation.status !== 'completed' || !simulation.completedAt) return;
    // Stopped before saying anything: nothing to judge, and ML refuses such a transcript.
    if (!this.hasCandidateTurn(simulation)) return;

    let assessmentId: string;
    try {
      const pending = await this.prisma.assessment.create({
        data: { simulationId, candidateId: simulation.candidateId, status: 'pending' },
        select: { id: true },
      });
      assessmentId = pending.id;
    } catch (error) {
      if (this.isUniqueViolation(error)) return;
      throw error;
    }

    try {
      await this.score(simulation, assessmentId);
    } catch (error) {
      // The simulation stays completed and progress exposes the failed assessment.
      this.logger.error(`Automatic assessment failed for simulation ${simulationId}: ${this.errorCode(error)}`);
    }
  }

  async rerun(simulationId: string): Promise<SimulationAssessmentDto> {
    const simulation = await this.loadSimulation(simulationId);
    if (simulation.status !== 'completed' || !simulation.completedAt) {
      throw new ConflictException({ code: 'SIMULATION_NOT_FINISHED', message: 'The simulation has not finished.' });
    }
    if (!this.hasCandidateTurn(simulation)) {
      throw new ConflictException({ code: 'NOTHING_TO_ASSESS', message: 'The candidate stopped before saying anything.' });
    }

    const existing = await this.prisma.assessment.findUnique({
      where: { simulationId }, select: { id: true },
    });
    let assessmentId: string;
    if (existing) {
      const pending = await this.prisma.assessment.update({
        where: { id: existing.id },
        data: { status: 'pending', result: Prisma.DbNull, feedback: Prisma.DbNull },
        select: { id: true },
      });
      assessmentId = pending.id;
    } else {
      try {
        const pending = await this.prisma.assessment.create({
          data: { simulationId, candidateId: simulation.candidateId, status: 'pending' },
          select: { id: true },
        });
        assessmentId = pending.id;
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
        const pending = await this.prisma.assessment.update({
          where: { simulationId },
          data: { status: 'pending', result: Prisma.DbNull, feedback: Prisma.DbNull },
          select: { id: true },
        });
        assessmentId = pending.id;
      }
    }

    await this.score(simulation, assessmentId);
    return this.get(assessmentId);
  }

  async get(assessmentId: string): Promise<SimulationAssessmentDto> {
    const stored = await this.prisma.assessment.findUnique({
      where: { id: assessmentId }, include: assessmentInclude,
    });
    if (!stored || stored.status !== 'ready' || !stored.result || !stored.simulation.completedAt) this.notFound();
    const result = stored.result as unknown as Pick<SimulationAssessmentDto, 'scores' | 'english' | 'interviewQuestions'>;
    const scenario = this.scenario(stored);
    return {
      assessmentId: stored.id,
      simulationId: stored.simulationId,
      candidateId: stored.candidateId,
      candidateLabel: stored.candidate.label,
      createdAt: stored.createdAt.toISOString(),
      simulation: {
        scenarioTitle: scenario.title,
        characterName: scenario.character.name,
        mode: stored.simulation.mode,
        accommodation: stored.simulation.accommodation,
        completedAt: stored.simulation.completedAt.toISOString(),
        durationSeconds: Math.max(0, Math.round(
          (stored.simulation.completedAt.getTime() - stored.simulation.createdAt.getTime()) / 1000,
        )),
        turns: stored.simulation.turns.map((turn) => ({
          turnId: this.turnId(turn.sequence),
          speaker: turn.speaker,
          text: turn.text,
          startedAt: (turn.startedAt ?? turn.createdAt).toISOString(),
          endedAt: (turn.endedAt ?? turn.createdAt).toISOString(),
          ...(turn.speaker === 'candidate' ? { recognitionConfidence: turn.recognitionConfidence ?? null } : {}),
        })),
      },
      scores: result.scores,
      english: result.english,
      interviewQuestions: result.interviewQuestions,
    };
  }

  async feedback(assessmentId: string): Promise<CandidateFeedbackDto> {
    const stored = await this.prisma.assessment.findUnique({
      where: { id: assessmentId }, include: assessmentInclude,
    });
    if (!stored || stored.status !== 'ready' || !stored.feedback) this.notFound();
    const feedback = stored.feedback as unknown as AssessmentResult['candidateFeedback'];
    const scenario = this.scenario(stored);
    return {
      assessmentId: stored.id,
      scenarioTitle: scenario.title,
      strengths: feedback.strengths,
      growth: feedback.growth,
      nextTime: feedback.nextTime,
    };
  }

  private async score(simulation: SimulationForAssessment, assessmentId: string): Promise<void> {
    const turns = simulation.turns.map((turn) => ({
      turnId: this.turnId(turn.sequence),
      speaker: turn.speaker,
      text: this.privacy.redactText(simulation.candidate.profile as Record<string, unknown>, turn.text),
      startedAt: (turn.startedAt ?? turn.createdAt).toISOString(),
      endedAt: (turn.endedAt ?? turn.createdAt).toISOString(),
    }));
    try {
      const result = await this.gateway.simulationAssessment({
        candidateId: simulation.candidateId,
        scenarioId: simulation.scenarioId,
        mode: simulation.mode,
        turns,
      });
      this.validateFeedback(result.candidateFeedback);
      const { candidateFeedback, ...report } = result;
      await this.prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          status: 'ready',
          result: report as unknown as Prisma.InputJsonValue,
          feedback: candidateFeedback as unknown as Prisma.InputJsonValue,
        },
      });
      await this.audit.record({
        action: 'assessment.ready', targetType: 'assessment', targetId: assessmentId,
        candidateId: simulation.candidateId, actorRole: undefined,
      });
      // The brief is made again, now with the English the simulation measured (#12).
      void this.briefs.startFor(simulation.candidateId, result.english);
    } catch (error) {
      await this.prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: 'failed', result: Prisma.DbNull, feedback: Prisma.DbNull },
      });
      throw error;
    }
  }

  private validateFeedback(feedback: AssessmentResult['candidateFeedback']): void {
    const content = [feedback.strengths, feedback.growth, feedback.nextTime];
    const forbidden = /\d|\b(?:score|rank|admit|reject|accept|pass|fail)\w*\b/i;
    if (content.some((items) => !Array.isArray(items) || items.some((item) => typeof item !== 'string' || forbidden.test(item)))) {
      throw new HttpException({ code: 'AI_INVALID_OUTPUT', message: 'The ML service returned invalid candidate feedback.' }, HttpStatus.BAD_GATEWAY);
    }
  }

  private async loadSimulation(simulationId: string): Promise<SimulationForAssessment> {
    const simulation = await this.prisma.simulation.findUnique({
      where: { id: simulationId }, include: simulationInclude,
    });
    if (!simulation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Simulation was not found.' });
    return simulation;
  }

  private scenario(assessment: StoredAssessment): { title: string; character: { name: string } } {
    const value = assessment.simulation.scenario;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpException({ code: 'INTERNAL_ERROR', message: 'The simulation scenario is unavailable.' }, 500);
    }
    const scenario = value as Record<string, unknown>;
    const character = scenario.character;
    if (typeof scenario.title !== 'string' || !character || typeof character !== 'object' ||
        Array.isArray(character) || typeof (character as Record<string, unknown>).name !== 'string') {
      throw new HttpException({ code: 'INTERNAL_ERROR', message: 'The simulation scenario is unavailable.' }, 500);
    }
    return { title: scenario.title, character: { name: (character as Record<string, string>).name } };
  }

  private turnId(sequence: number): string { return `turn_${String(sequence).padStart(2, '0')}`; }

  private hasCandidateTurn(simulation: SimulationForAssessment): boolean {
    return simulation.turns.some((turn) => turn.speaker === 'candidate');
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (response && typeof response === 'object' && 'code' in response) return String(response.code);
    }
    return 'INTERNAL_ERROR';
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Assessment was not found.' });
  }
}
