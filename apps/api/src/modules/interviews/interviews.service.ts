import {
  BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AI_GATEWAY, AiGateway } from '../../ai-client/ai-gateway.port';
import type { components } from '../../ai-client/schema';
import { ApiRole } from '../../auth/roles';
import { PrismaService } from '../../database/prisma.service';
import { ToLlmViewService } from '../../privacy/to-llm-view.service';
import { AuditService } from '../audit/audit.service';
import { ConsistencyService } from '../consistency/consistency.service';
import {
  AssessmentDraftDto, CreateInterviewDto, InterviewDto, InterviewerScoresSavedDto, InterviewTurnDto,
} from './dto/interview.dto';
import { InterviewAudioService } from './interview-audio.service';

type Competency = 'D' | 'R' | 'I' | 'V' | 'E';
type Score = 0 | 1 | 2 | 3 | 4 | null;
type Scores = Record<Competency, Score>;
type DraftResult = components['schemas']['DraftResult'];

const competencies: Competency[] = ['D', 'R', 'I', 'V', 'E'];
/** "Up to 60 minutes", with a moment's slack for how a recorder rounds. */
const MAX_RECORDING_SECONDS = 60 * 60 + 5;

const interviewSelect = {
  id: true, candidateId: true, interviewerRef: true, heldAt: true, transcriptStatus: true, transcript: true, transcriptSource: true,
  notes: true, candidate: { select: { label: true, profile: true } }, interviewerScore: { select: { scores: true, savedAt: true } },
} as const satisfies Prisma.InterviewSelect;
type InterviewRow = Prisma.InterviewGetPayload<{ select: typeof interviewSelect }>;

export interface UploadedAudio {
  buffer: Buffer;
  size: number;
}

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
    private readonly audio: InterviewAudioService,
    private readonly privacy: ToLlmViewService,
    private readonly audit: AuditService,
    private readonly consistency: ConsistencyService,
  ) {}

  /** An interview, with inVision's own transcript or without one yet — then a recording brings it. */
  async create(input: CreateInterviewDto, role: ApiRole): Promise<InterviewDto> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: input.candidateId }, select: { id: true } });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });
    const transcript = input.transcript?.length ? this.withIds(input.transcript) : null;
    if (transcript && input.transcriptSource !== 'platform') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A transcript comes with `transcriptSource: "platform"`.', details: { fields: ['transcriptSource'] } });
    }

    const row = await this.prisma.interview.create({
      data: {
        candidateId: input.candidateId,
        interviewerRef: input.interviewerRef ?? null,
        heldAt: new Date(input.heldAt),
        transcriptStatus: transcript ? 'ready' : 'none',
        transcript: transcript ? (transcript as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        transcriptSource: transcript ? 'platform' : null,
        notes: (input.notes ?? []).map((text, index) => ({ id: `note_${index + 1}`, text })),
      },
      select: interviewSelect,
    });
    await this.audit.record({ action: 'interview.created', targetType: 'interview', targetId: row.id, candidateId: row.candidateId, actorRole: role });
    if (transcript) await this.audit.record({ action: 'transcript.ready', targetType: 'interview', targetId: row.id, candidateId: row.candidateId, actorRole: role });
    return this.toDto(row);
  }

  /**
   * The recording made on the interviewer's screen. It answers at once with
   * `transcribing`; the audio is transcribed, stored as text and deleted.
   */
  async recording(interviewId: string, upload: UploadedAudio | undefined, consent: unknown, role: ApiRole): Promise<InterviewDto> {
    if (consent !== 'true') {
      throw new BadRequestException({ code: 'CONSENT_REQUIRED', message: 'The candidate must consent to the recording.' });
    }
    const extension = upload ? this.audio.extension(upload.buffer) : null;
    if (!upload || !extension) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A webm, ogg or wav recording is required.', details: { fields: ['audio'] } });
    }
    const row = await this.find(interviewId);
    if (row.transcriptStatus === 'ready' || row.transcriptStatus === 'transcribing') this.transcriptExists();

    const audioRef = await this.audio.save(interviewId, extension, upload.buffer);
    try {
      if (await this.audio.durationSeconds(audioRef) > MAX_RECORDING_SECONDS) {
        throw new HttpException({ code: 'PAYLOAD_TOO_LARGE', message: 'A recording is at most 60 minutes.' }, HttpStatus.PAYLOAD_TOO_LARGE);
      }
      const { count } = await this.prisma.interview.updateMany({
        where: { id: interviewId, transcriptStatus: { in: ['none', 'failed'] } },
        data: { transcriptStatus: 'transcribing', transcriptSource: 'recording' },
      });
      if (count === 0) this.transcriptExists();
    } catch (error) {
      await this.audio.delete(audioRef);
      throw error;
    }

    await this.audit.record({ action: 'recording.uploaded', targetType: 'interview', targetId: interviewId, candidateId: row.candidateId, actorRole: role });
    void this.transcribe(interviewId, row.candidateId, audioRef);
    return this.toDto({ ...row, transcriptStatus: 'transcribing', transcriptSource: 'recording' });
  }

  async get(interviewId: string): Promise<InterviewDto> {
    return this.toDto(await this.find(interviewId));
  }

  /**
   * The interviewer's own scores, blind. All five, each 0–4 or null; fixed
   * once saved, so the comparison with the draft stays honest.
   */
  async saveScores(interviewId: string, input: unknown, role: ApiRole): Promise<InterviewerScoresSavedDto> {
    const scores = this.validScores(input);
    const row = await this.find(interviewId);
    if (row.interviewerScore) {
      const saved = row.interviewerScore.scores as unknown as Scores;
      if (competencies.every((competency) => saved[competency] === scores[competency])) {
        return { interviewId, scores: saved, savedAt: row.interviewerScore.savedAt.toISOString() };
      }
      throw new ConflictException({ code: 'SCORES_ALREADY_SAVED', message: 'The scores are already saved and cannot change.' });
    }

    let savedAt: Date;
    try {
      ({ savedAt } = await this.prisma.interviewerScore.create({
        data: { interviewId, scores: scores as unknown as Prisma.InputJsonValue },
        select: { savedAt: true },
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'SCORES_ALREADY_SAVED', message: 'The scores are already saved and cannot change.' });
      }
      throw error;
    }
    await this.audit.record({ action: 'scores.saved', targetType: 'interview', targetId: interviewId, candidateId: row.candidateId, actorRole: role });
    void this.afterBoth(interviewId);
    return { interviewId, scores, savedAt: savedAt.toISOString() };
  }

  /** A draft now — the admin's or the interviewer's re-run. Locked until the scores exist. */
  async createDraft(interviewId: string): Promise<AssessmentDraftDto> {
    const row = await this.find(interviewId);
    if (!row.interviewerScore) this.draftLocked();
    if (row.transcriptStatus !== 'ready') this.transcriptMissing();
    const draftId = await this.generate(row, { rethrow: true });
    return this.getDraft(interviewId, draftId);
  }

  /** The latest ready draft — never before the interviewer's scores are saved. */
  async getDraft(interviewId: string, draftId?: string): Promise<AssessmentDraftDto> {
    const row = await this.find(interviewId);
    if (!row.interviewerScore) this.draftLocked();
    const draft = await this.prisma.interviewDraft.findFirst({
      where: { interviewId, status: 'ready', ...(draftId ? { id: draftId } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { result: true, createdAt: true },
    });
    if (!draft?.result) throw new NotFoundException({ code: 'DRAFT_NOT_FOUND', message: 'The draft has not been generated yet.' });
    return { interviewId, createdAt: draft.createdAt.toISOString(), scores: (draft.result as unknown as DraftResult).scores as AssessmentDraftDto['scores'] };
  }

  private async transcribe(interviewId: string, candidateId: string, audioRef: string): Promise<void> {
    try {
      const result = await this.gateway.transcribeInterview(audioRef);
      const transcript = this.withIds(result.turns.filter((turn) => turn.text.trim()));
      // Nothing recognised is nothing to read: the recording failed, and a new one may be sent.
      if (transcript.length === 0) throw new Error('No speech was recognised in the recording');
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: { transcriptStatus: 'ready', transcript: transcript as unknown as Prisma.InputJsonValue },
      });
      await this.audit.record({ action: 'transcript.ready', targetType: 'interview', targetId: interviewId, candidateId });
      await this.afterBoth(interviewId);
    } catch (error) {
      this.logger.error(`Interview ${interviewId} was not transcribed: ${error instanceof Error ? error.message : String(error)}`);
      await this.prisma.interview.update({ where: { id: interviewId }, data: { transcriptStatus: 'failed' } }).catch(() => undefined);
    } finally {
      // Only the text is kept.
      await this.audio.delete(audioRef).catch(() => undefined);
    }
  }

  /**
   * Once the transcript and the scores both exist, whichever came second,
   * the draft and the after-interview consistency follow by themselves.
   * Neither throws.
   */
  private async afterBoth(interviewId: string): Promise<void> {
    await Promise.all([this.draftWhenReady(interviewId), this.consistency.startAfter(interviewId)]);
  }

  /**
   * The draft follows by itself once both the transcript and the scores
   * exist, whichever came second. It never throws: a failure is kept as a
   * failed draft, and a re-run is a POST.
   */
  private async draftWhenReady(interviewId: string): Promise<void> {
    try {
      const row = await this.find(interviewId);
      if (!row.interviewerScore || row.transcriptStatus !== 'ready') return;
      const existing = await this.prisma.interviewDraft.findFirst({ where: { interviewId, status: { in: ['pending', 'ready'] } }, select: { id: true } });
      if (existing) return;
      await this.generate(row, { rethrow: false });
    } catch (error) {
      this.logger.error(`Draft for interview ${interviewId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** ML reads the transcript and the notes, redacted — and has no field for the interviewer's scores. */
  private async generate(row: InterviewRow, { rethrow }: { rethrow: boolean }): Promise<string> {
    const profile = row.candidate.profile as Record<string, unknown>;
    const transcript = (row.transcript as unknown as InterviewTurnDto[]).map((turn) => ({ ...turn, text: this.privacy.redactText(profile, turn.text) }));
    const notes = ((row.notes ?? []) as unknown as { id: string; text: string }[]).map((note) => ({ ...note, text: this.privacy.redactText(profile, note.text) }));
    const pending = await this.prisma.interviewDraft.create({ data: { interviewId: row.id, status: 'pending' }, select: { id: true } });
    try {
      const result = await this.gateway.interviewDraft({ candidateId: row.candidateId, transcript, notes });
      await this.prisma.interviewDraft.update({ where: { id: pending.id }, data: { status: 'ready', result: result as unknown as Prisma.InputJsonValue } });
      await this.audit.record({ action: 'draft.created', targetType: 'interview', targetId: row.id, candidateId: row.candidateId });
    } catch (error) {
      await this.prisma.interviewDraft.update({ where: { id: pending.id }, data: { status: 'failed' } });
      if (rethrow) throw error;
      this.logger.error(`Draft ${pending.id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return pending.id;
  }

  private validScores(input: unknown): Scores {
    const scores = (input ?? {}) as Record<string, unknown>;
    const missing = competencies.filter((competency) =>
      !(competency in scores) || !(scores[competency] === null || [0, 1, 2, 3, 4].includes(scores[competency] as number)));
    const extra = Object.keys(scores).filter((key) => !competencies.includes(key as Competency));
    if (missing.length || extra.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'All five competencies are needed, each 0–4 or null for "not enough to judge".',
        details: { fields: [...missing, ...extra].map((key) => `scores.${key}`) },
      });
    }
    return Object.fromEntries(competencies.map((competency) => [competency, scores[competency]])) as Scores;
  }

  /**
   * The interviewer's notes, taken during the call. They feed the draft, so
   * they close with the scores: after those are saved they are fixed.
   */
  async saveNotes(interviewId: string, notes: string[]): Promise<InterviewDto> {
    const row = await this.find(interviewId);
    if (row.interviewerScore) throw new ConflictException({ code: 'SCORES_ALREADY_SAVED', message: 'The scores are saved, so the notes are fixed.' });
    const kept = notes.map((text) => text.trim()).filter(Boolean);
    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: { notes: kept.map((text, index) => ({ id: `note_${index + 1}`, text })) },
      select: interviewSelect,
    });
    return this.toDto(updated);
  }

  private withIds(turns: { speaker: 'interviewer' | 'candidate'; text: string; startSec: number; endSec: number }[]): InterviewTurnDto[] {
    return turns.map((turn, index) => ({
      turnId: `iturn_${String(index + 1).padStart(2, '0')}`, speaker: turn.speaker, text: turn.text.trim(), startSec: turn.startSec, endSec: turn.endSec,
    }));
  }

  private async find(interviewId: string): Promise<InterviewRow> {
    const row = await this.prisma.interview.findUnique({ where: { id: interviewId }, select: interviewSelect });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Interview was not found.' });
    return row;
  }

  private toDto(row: InterviewRow): InterviewDto {
    return {
      interviewId: row.id,
      candidateId: row.candidateId,
      candidateLabel: row.candidate.label,
      interviewerRef: row.interviewerRef,
      heldAt: row.heldAt.toISOString(),
      transcriptStatus: row.transcriptStatus as InterviewDto['transcriptStatus'],
      transcriptSource: row.transcriptSource as InterviewDto['transcriptSource'],
      transcript: row.transcriptStatus === 'ready' ? (row.transcript as unknown as InterviewTurnDto[]) : null,
      notes: (row.notes ?? []) as unknown as InterviewDto['notes'],
      interviewerScores: (row.interviewerScore?.scores as unknown as Scores | undefined) ?? null,
      scoredAt: row.interviewerScore?.savedAt.toISOString() ?? null,
    };
  }

  private transcriptExists(): never {
    throw new ConflictException({ code: 'TRANSCRIPT_EXISTS', message: 'This interview already has a transcript.' });
  }

  private transcriptMissing(): never {
    throw new ConflictException({ code: 'TRANSCRIPT_MISSING', message: 'The interview has no transcript yet.' });
  }

  private draftLocked(): never {
    throw new ConflictException({ code: 'DRAFT_LOCKED', message: "Save the interviewer's scores first." });
  }
}
