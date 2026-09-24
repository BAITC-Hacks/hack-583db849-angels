import { randomUUID, createHash } from 'node:crypto';

import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SimulationTurn } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import { ApiRole } from '../../auth/roles';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ToLlmViewService } from '../../privacy/to-llm-view.service';
import { AccommodationDto, UpdateAccommodationDto } from '../candidates/dto/accommodation.dto';
import { SimulationDto, TurnResultDto } from './dto/simulation.dto';
import { AudioStorageService } from './audio-storage.service';

export interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const turnsInOrder = { orderBy: { sequence: 'asc' } } as const;
type SimulationWithTurns = Prisma.SimulationGetPayload<{ include: { turns: typeof turnsInOrder } }>;

@Injectable()
export class SimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly audio: AudioStorageService,
    private readonly privacy: ToLlmViewService,
    private readonly audit: AuditService,
  ) {}

  async create(candidateId: string, actorRole: ApiRole): Promise<SimulationDto> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { id: true } });
    if (!candidate) this.notFound('Candidate');
    const existing = await this.prisma.simulation.findUnique({ where: { candidateId }, select: { id: true } });
    if (existing) this.alreadyExists(existing.id);

    const [scenarios, counts] = await Promise.all([
      this.gateway.scenarios(),
      this.prisma.simulation.groupBy({ by: ['scenarioId'], _count: { _all: true } }),
    ]);
    const assigned = new Map(counts.map((item) => [item.scenarioId, item._count._all]));
    const ready = scenarios.filter((scenario) => scenario.status === 'ready');
    if (!ready.length) {
      throw new HttpException({ code: 'NO_SCENARIO_READY', message: 'No scenario is ready.' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const minimum = Math.min(...ready.map((scenario) => assigned.get(scenario.scenarioId) ?? 0));
    const leastAssigned = ready.filter((scenario) => (assigned.get(scenario.scenarioId) ?? 0) === minimum);
    const selected = leastAssigned[Math.floor(Math.random() * leastAssigned.length)];
    const { status: _status, ...scenario } = selected;
    void _status;

    const opening = await this.gateway.simulationTurn({ scenarioId: scenario.scenarioId, turns: [] });
    const speech = await this.gateway.speech(opening.text, scenario.scenarioId);
    const simulationId = randomUUID();
    const audioPath = await this.audio.saveCharacter(simulationId, speech);
    const startedAt = new Date();
    let created: SimulationWithTurns;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        await this.lockCandidate(tx, candidateId);
        const conflict = await tx.simulation.findUnique({ where: { candidateId }, select: { id: true } });
        if (conflict) this.alreadyExists(conflict.id);
        const accommodation = await tx.accommodation.findUnique({ where: { candidateId } });
        return tx.simulation.create({
        data: {
          id: simulationId, candidateId, scenarioId: scenario.scenarioId,
          scenario: scenario as Prisma.InputJsonValue,
          mode: accommodation?.textMode ? 'text' : 'voice',
          accommodation: Boolean(accommodation?.textMode),
          status: opening.ended ? 'completed' : 'active',
          stage: opening.stage,
          ending: opening.ended ? 'completed' : null,
          completedAt: opening.ended ? startedAt : null,
          turns: { create: {
            sequence: 1, speaker: 'character', text: opening.text, startedAt, endedAt: startedAt,
            director: opening.director as Prisma.InputJsonValue, audioPath,
          } },
        },
        include: { turns: turnsInOrder },
        });
      });
    } catch (error) {
      await this.audio.delete(audioPath);
      if (this.isUniqueViolation(error)) {
        const winner = await this.prisma.simulation.findUnique({ where: { candidateId }, select: { id: true } });
        if (winner) this.alreadyExists(winner.id);
      }
      throw error;
    }
    await this.audit.record({ action: 'simulation.created', targetType: 'simulation', targetId: created.id, candidateId, actorRole,
      metadata: { scenarioId: scenario.scenarioId, nextBeat: opening.director.nextBeat } });
    return this.toDto(created);
  }

  async turn(simulationId: string, input: { text?: string; audio?: UploadedAudio }, actorRole: ApiRole): Promise<TurnResultDto> {
    const current = await this.load(simulationId);
    if (current.status === 'completed') this.finished();
    if (input.text !== undefined && current.mode !== 'text') {
      throw new ForbiddenException({ code: 'TEXT_MODE_NOT_ALLOWED', message: 'Text turns require an accommodation.' });
    }
    if (input.text === undefined && !input.audio) this.invalid('audio');

    const claim = await this.prisma.simulation.updateMany({
      where: { id: simulationId, status: 'active', turnInFlight: false },
      data: { turnInFlight: true },
    });
    if (claim.count !== 1) {
      const latest = await this.prisma.simulation.findUnique({ where: { id: simulationId }, select: { status: true } });
      if (latest?.status === 'completed') this.finished();
      throw new ConflictException({ code: 'TURN_IN_FLIGHT', message: 'A turn is already being processed.' });
    }

    let candidateAudioRef: string | undefined;
    let characterAudioRef: string | undefined;
    let candidateTurnId: string | undefined;
    let committed = false;
    try {
      const latest = await this.load(simulationId);
      const previous = [...latest.turns].reverse().find((turn) => turn.speaker === 'character');
      const nextBeat = this.record(previous?.director)?.nextBeat;
      if (typeof nextBeat !== 'string') throw new Error('The previous director decision is missing nextBeat');

      let text = input.text?.trim();
      let confidence: number | null = null;
      let startedAt = new Date();
      let endedAt = startedAt;
      if (input.audio) {
        const extension = this.audioExtension(input.audio);
        candidateAudioRef = await this.audio.saveCandidate(simulationId, extension, input.audio.buffer);
        const duration = await this.audio.durationSeconds(candidateAudioRef);
        if (duration > 60) this.invalid('audio');
        const transcription = await this.gateway.transcribeTurn(candidateAudioRef);
        const segments = transcription.turns.filter((segment) => segment.speaker === 'candidate' && segment.text.trim());
        text = segments.map((segment) => segment.text.trim()).join(' ').trim();
        if (!text) {
          throw new HttpException({ code: 'SPEECH_NOT_RECOGNISED', message: 'No speech was recognised.' }, HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const confidences = segments.map((segment) => segment.confidence)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        confidence = confidences.length ? Math.min(...confidences) : null;
        endedAt = new Date();
        startedAt = new Date(endedAt.getTime() - Math.min(duration, 60) * 1000);
      }
      if (!text || text.length > 1000) this.invalid(input.audio ? 'audio' : 'text');

      const sequence = latest.turns.at(-1)?.sequence ?? 0;
      const candidateTurns = latest.turns.filter((turn) => turn.speaker === 'candidate').length + 1;
      const candidate = await this.prisma.candidate.findUnique({ where: { id: latest.candidateId }, select: { profile: true } });
      if (!candidate) this.notFound('Candidate');

      const savedCandidate = await this.prisma.simulationTurn.create({ data: {
        simulationId, sequence: sequence + 1, speaker: 'candidate', text, startedAt, endedAt,
        recognitionConfidence: confidence,
      } });
      candidateTurnId = savedCandidate.id;
      if (candidateAudioRef) {
        await this.audio.delete(candidateAudioRef);
        candidateAudioRef = undefined;
      }

      const fullTranscript = [...latest.turns, savedCandidate].map((turn) => ({
        turnId: this.turnId(turn.sequence), speaker: turn.speaker,
        text: this.privacy.redactText(candidate.profile as Record<string, unknown>, turn.text),
        startedAt: this.turnDate(turn.startedAt, turn.createdAt),
        endedAt: this.turnDate(turn.endedAt, turn.createdAt),
      }));
      const answer = await this.gateway.simulationTurn({
        scenarioId: latest.scenarioId, turns: fullTranscript,
        state: { beat: nextBeat, candidateTurns },
      });
      const speech = await this.gateway.speech(answer.text, latest.scenarioId);
      characterAudioRef = await this.audio.saveCharacter(simulationId, speech);
      const characterTime = new Date();
      const [characterTurn] = await this.prisma.$transaction([
        this.prisma.simulationTurn.create({ data: {
          simulationId, sequence: sequence + 2, speaker: 'character', text: answer.text,
          startedAt: characterTime, endedAt: characterTime,
          director: answer.director as Prisma.InputJsonValue, audioPath: characterAudioRef,
        } }),
        this.prisma.simulation.update({ where: { id: simulationId }, data: {
          stage: answer.stage, status: answer.ended ? 'completed' : 'active',
          ending: answer.ended ? 'completed' : null,
          completedAt: answer.ended ? characterTime : null,
        } }),
      ]);
      committed = true;
      await this.audit.record({ action: 'simulation.turn', targetType: 'simulation', targetId: simulationId,
        candidateId: latest.candidateId, actorRole,
        metadata: { turnId: this.turnId(savedCandidate.sequence), nextBeat: answer.director.nextBeat,
          matchedAnswerType: answer.director.matchedAnswerType, similarity: answer.director.similarity,
          ended: answer.ended } });
      if (answer.ended) {
        await this.audit.record({ action: 'simulation.completed', targetType: 'simulation', targetId: simulationId,
          candidateId: latest.candidateId, actorRole, metadata: { ending: 'completed' } });
      }
      return {
        candidateTurn: this.toTurn(savedCandidate), characterTurn: this.toTurn(characterTurn),
        stage: answer.stage, status: answer.ended ? 'completed' : 'active', candidateTurns,
        recognitionConfidence: confidence,
        characterAudioUrl: `/v1/simulations/${simulationId}/turns/${this.turnId(characterTurn.sequence)}/audio`,
      };
    } catch (error) {
      if (!committed) {
        if (candidateTurnId) await this.prisma.simulationTurn.delete({ where: { id: candidateTurnId } });
        if (characterAudioRef) await this.audio.delete(characterAudioRef);
      }
      throw error;
    } finally {
      if (candidateAudioRef) await this.audio.delete(candidateAudioRef);
      await this.prisma.simulation.updateMany({ where: { id: simulationId }, data: { turnInFlight: false } });
    }
  }

  async complete(simulationId: string, reason: 'completed' | 'stopped', actorRole: ApiRole): Promise<SimulationDto> {
    const now = new Date();
    const completed = await this.prisma.simulation.updateMany({
      where: { id: simulationId, status: 'active', turnInFlight: false },
      data: { status: 'completed', stage: 'finished', ending: reason, completedAt: now },
    });
    if (completed.count !== 1) {
      const existing = await this.prisma.simulation.findUnique({ where: { id: simulationId }, select: { status: true } });
      if (!existing) this.notFound('Simulation');
      if (existing.status === 'completed') this.finished();
      throw new ConflictException({ code: 'TURN_IN_FLIGHT', message: 'A turn is already being processed.' });
    }
    const simulation = await this.load(simulationId);
    await this.audit.record({ action: 'simulation.completed', targetType: 'simulation', targetId: simulationId,
      candidateId: simulation.candidateId, actorRole, metadata: { ending: reason } });
    return this.toDto(simulation);
  }

  async get(simulationId: string): Promise<SimulationDto> {
    return this.toDto(await this.load(simulationId));
  }

  async characterAudio(simulationId: string, turnId: string): Promise<Buffer> {
    const sequence = /^turn_(\d{2,})$/.exec(turnId);
    if (!sequence) this.notFound('Audio');
    const turn = await this.prisma.simulationTurn.findFirst({
      where: { simulationId, sequence: Number(sequence[1]), speaker: 'character' },
      select: { audioPath: true },
    });
    if (!turn?.audioPath) this.notFound('Audio');
    return this.audio.read(turn.audioPath);
  }

  async accommodation(candidateId: string, input: UpdateAccommodationDto, actorRole: 'commission' | 'admin'): Promise<AccommodationDto> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { id: true } });
    if (!candidate) this.notFound('Candidate');
    const saved = await this.prisma.$transaction(async (tx) => {
      await this.lockCandidate(tx, candidateId);
      const simulation = await tx.simulation.findUnique({ where: { candidateId }, select: { id: true } });
      if (simulation) {
        throw new ConflictException({ code: 'SIMULATION_STARTED', message: 'The accommodation cannot change after the simulation starts.' });
      }
      return tx.accommodation.upsert({
        where: { candidateId },
        create: { candidateId, textMode: input.textMode, reason: input.reason, setByRole: actorRole },
        update: { textMode: input.textMode, reason: input.reason, setByRole: actorRole },
      });
    });
    await this.audit.record({ action: 'candidate.accommodation', targetType: 'candidate', targetId: candidateId,
      candidateId, actorRole, metadata: { textMode: saved.textMode } });
    return { candidateId, textMode: saved.textMode, reason: saved.reason,
      setByRole: saved.setByRole as 'commission' | 'admin', setAt: saved.updatedAt.toISOString() };
  }

  idempotencyBody(simulationId: string, input: { text?: string; audio?: UploadedAudio }): Record<string, unknown> {
    return input.audio
      ? { operation: 'simulation.turn', simulationId, audioDigest: createHash('sha256').update(input.audio.buffer).digest('hex') }
      : { operation: 'simulation.turn', simulationId, text: input.text };
  }

  private async load(id: string): Promise<SimulationWithTurns> {
    const simulation = await this.prisma.simulation.findUnique({ where: { id }, include: { turns: turnsInOrder } });
    if (!simulation) this.notFound('Simulation');
    return simulation;
  }

  private async toDto(simulation: SimulationWithTurns): Promise<SimulationDto> {
    let scenario = simulation.scenario as unknown as SimulationDto['scenario'] | null;
    if (!scenario) {
      const previous = (await this.gateway.scenarios()).find((item) => item.scenarioId === simulation.scenarioId);
      if (!previous) this.notFound('Scenario');
      const { status: _status, ...publicScenario } = previous;
      void _status;
      scenario = publicScenario;
    }
    return {
      simulationId: simulation.id, candidateId: simulation.candidateId,
      scenario,
      mode: simulation.mode, accommodation: simulation.accommodation,
      status: simulation.status, stage: simulation.stage as SimulationDto['stage'],
      ending: simulation.ending as SimulationDto['ending'],
      startedAt: simulation.createdAt.toISOString(), completedAt: simulation.completedAt?.toISOString() ?? null,
      turns: simulation.turns.map((turn) => this.toTurn(turn)),
    };
  }

  private toTurn(turn: SimulationTurn): SimulationDto['turns'][number] {
    return { turnId: this.turnId(turn.sequence), speaker: turn.speaker, text: turn.text,
      startedAt: this.turnDate(turn.startedAt, turn.createdAt), endedAt: this.turnDate(turn.endedAt, turn.createdAt) };
  }

  private turnDate(date: Date | null, fallback: Date): string { return (date ?? fallback).toISOString(); }
  private turnId(sequence: number): string { return `turn_${String(sequence).padStart(2, '0')}`; }

  private audioExtension(audio: UploadedAudio): 'webm' | 'ogg' {
    if (!audio.buffer.length || !audio.size) this.invalid('audio');
    if (audio.mimetype === 'audio/webm' || audio.mimetype === 'video/webm') return 'webm';
    if (audio.mimetype === 'audio/ogg' || audio.mimetype === 'application/ogg') return 'ogg';
    this.invalid('audio');
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async lockCandidate(tx: Prisma.TransactionClient, candidateId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "Candidate" WHERE "id" = ${candidateId}::uuid FOR UPDATE`;
  }

  private invalid(field: string): never {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'The turn does not match the required input.', details: { fields: [field] } });
  }
  private notFound(what: string): never {
    throw new NotFoundException({ code: 'NOT_FOUND', message: `${what} was not found.` });
  }
  private finished(): never {
    throw new ConflictException({ code: 'SIMULATION_FINISHED', message: 'The simulation has already finished.' });
  }
  private alreadyExists(simulationId: string): never {
    throw new ConflictException({ code: 'SIMULATION_EXISTS', message: 'A simulation already exists for this candidate.', details: { simulationId } });
  }
}
