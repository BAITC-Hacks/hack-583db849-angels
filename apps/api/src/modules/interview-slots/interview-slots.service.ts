import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { ApiRole } from '../../auth/roles';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InterviewsService } from '../interviews/interviews.service';
import { CallAccessDto, CreateSlotDto, InterviewSlotDto, InterviewSlotListDto, JoinCallDto, SlotQueryDto } from './interview-slot.dto';
import { liveKitToken } from './livekit-token';
import { dayKey, endsAt, missedBy, opensAt, rejoinUntil, slotStatus, waitUntil } from './slot-status';

const slotSelect = {
  id: true, interviewerRef: true, startsAt: true, durationMin: true, candidateId: true, candidateJoinedAt: true,
  interviewerJoinedAt: true, consentRecording: true, interviewId: true, candidate: { select: { label: true } },
} as const satisfies Prisma.InterviewSlotSelect;
type SlotRow = Prisma.InterviewSlotGetPayload<{ select: typeof slotSelect }>;

/** How far back a staff list reaches, so a missed or finished slot stays in sight for a week. */
const LIST_DAYS_BACK = 7;
const DAY = 24 * 60 * 60 * 1000;

/**
 * V: the scheduled video interview. Interviewers offer slots, a candidate
 * books one, and both join a LiveKit room with a token from here. The rules
 * live in this service; the call itself runs on LiveKit.
 */
@Injectable()
export class InterviewSlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly interviews: InterviewsService,
    private readonly config: ConfigService,
  ) {}

  async create(input: CreateSlotDto, role: ApiRole): Promise<InterviewSlotDto> {
    const now = new Date();
    const startsAt = new Date(input.startsAt);
    if (startsAt <= now) throw new BadRequestException({ code: 'SLOT_IN_PAST', message: 'A slot starts in the future.' });
    const durationMin = input.durationMin ?? 30;
    const end = startsAt.getTime() + durationMin * 60_000;

    // The longest slot is 90 minutes, so any slot that could overlap starts within that of this one.
    const near = await this.prisma.interviewSlot.findMany({
      where: { interviewerRef: input.interviewerRef, startsAt: { gt: new Date(startsAt.getTime() - 90 * 60_000), lt: new Date(end) } },
      select: slotSelect,
    });
    const overlap = near.find((slot) => endsAt(slot).getTime() > startsAt.getTime());
    if (overlap) {
      throw new ConflictException({ code: 'SLOT_OVERLAPS', message: 'This slot overlaps another of the same interviewer.', details: { slotId: overlap.id } });
    }

    const row = await this.prisma.interviewSlot.create({
      data: { interviewerRef: input.interviewerRef, startsAt, durationMin },
      select: slotSelect,
    });
    await this.audit.record({ action: 'slot.created', targetType: 'interview_slot', targetId: row.id, actorRole: role });
    return this.toDto(row, role, now);
  }

  async list(query: SlotQueryDto, role: ApiRole): Promise<InterviewSlotListDto> {
    const now = new Date();
    const open: Prisma.InterviewSlotWhereInput = { candidateId: null, startsAt: { gt: now } };
    let where: Prisma.InterviewSlotWhereInput;
    if (query.candidateId) where = query.open ? { OR: [open, { candidateId: query.candidateId }] } : { candidateId: query.candidateId };
    else if (query.open || role === 'platform') where = open;
    else where = { startsAt: { gte: new Date(now.getTime() - LIST_DAYS_BACK * DAY) } };

    const rows = await this.prisma.interviewSlot.findMany({ where, orderBy: { startsAt: 'asc' }, select: slotSelect });
    return { items: rows.map((row) => this.toDto(row, role, now)) };
  }

  async get(slotId: string, role: ApiRole): Promise<InterviewSlotDto> {
    return this.toDto(await this.find(slotId), role, new Date());
  }

  async remove(slotId: string): Promise<void> {
    const row = await this.find(slotId);
    if (row.candidateId) throw new ConflictException({ code: 'SLOT_BOOKED', message: 'A candidate has booked this slot.' });
    await this.prisma.interviewSlot.delete({ where: { id: slotId } });
  }

  /**
   * One booking at a time, none after the interview has taken place, and
   * never on the day of a slot the candidate missed.
   */
  async book(slotId: string, candidateId: string, role: ApiRole): Promise<InterviewSlotDto> {
    const now = new Date();
    const row = await this.find(slotId);
    if (row.candidateId === candidateId) return this.toDto(row, role, now);
    if (row.candidateId) throw new ConflictException({ code: 'SLOT_TAKEN', message: 'Another candidate has booked this slot.' });
    if (row.startsAt <= now) throw new ConflictException({ code: 'SLOT_PASSED', message: 'This slot has already started.' });

    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { id: true } });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Candidate was not found.' });

    const mine = await this.prisma.interviewSlot.findMany({ where: { candidateId }, select: slotSelect });
    for (const slot of mine) {
      const status = slotStatus(slot, now);
      if (status === 'live' || status === 'done') {
        throw new ConflictException({ code: 'ALREADY_INTERVIEWED', message: 'The interview has already taken place.' });
      }
      if (status === 'booked' || status === 'waiting') {
        throw new ConflictException({ code: 'ALREADY_BOOKED', message: 'The candidate already has a slot.', details: { slotId: slot.id } });
      }
    }
    const zone = this.timeZone();
    const day = dayKey(row.startsAt, zone);
    if (mine.some((slot) => slotStatus(slot, now) === 'missed' && dayKey(slot.startsAt, zone) === day)) {
      throw new ConflictException({ code: 'SAME_DAY_AS_MISSED', message: 'After a missed slot, book one on another day.', details: { day } });
    }

    // Two candidates can reach this line for the same slot: only one update finds it still free.
    const booked = await this.prisma.interviewSlot.updateMany({ where: { id: slotId, candidateId: null }, data: { candidateId, bookedAt: now } });
    if (booked.count === 0) throw new ConflictException({ code: 'SLOT_TAKEN', message: 'Another candidate has booked this slot.' });
    await this.audit.record({ action: 'slot.booked', targetType: 'interview_slot', targetId: slotId, candidateId, actorRole: role });
    return this.toDto(await this.find(slotId), role, now);
  }

  /**
   * A room token for one side of the call. The candidate's channel joins as
   * the candidate; staff join as the interviewer, and the first interviewer
   * join makes the M4 interview the call feeds.
   */
  async join(slotId: string, input: JoinCallDto, role: ApiRole): Promise<CallAccessDto> {
    const livekit = this.liveKit();
    if (!livekit) throw new HttpException({ code: 'VIDEO_UNAVAILABLE', message: 'Video calls are not set up on this server.' }, HttpStatus.SERVICE_UNAVAILABLE);

    const now = new Date();
    let row = await this.find(slotId);
    const { candidateId } = row;
    if (!candidateId) throw new ConflictException({ code: 'SLOT_NOT_BOOKED', message: 'Nobody has booked this slot.' });
    if (now < opensAt(row)) {
      throw new ConflictException({ code: 'TOO_EARLY', message: 'The call opens 10 minutes before the start.', details: { opensAt: opensAt(row).toISOString() } });
    }
    const status = slotStatus(row, now);
    if (status === 'missed') {
      throw new ConflictException({ code: 'SLOT_MISSED', message: 'Nobody waits more than 5 minutes: this slot is missed.', details: { missedBy: missedBy(row, now) } });
    }
    if (status === 'done' && now >= rejoinUntil(row)) throw new ConflictException({ code: 'SLOT_OVER', message: 'This call is over.' });

    const side = role === 'platform' ? 'candidate' : 'interviewer';
    const first = side === 'candidate' ? !row.candidateJoinedAt : !row.interviewerJoinedAt;
    if (side === 'interviewer' && !row.interviewId) {
      const interview = await this.interviews.create({ candidateId, heldAt: row.startsAt.toISOString(), interviewerRef: row.interviewerRef }, role);
      const linked = await this.prisma.interviewSlot.updateMany({ where: { id: slotId, interviewId: null }, data: { interviewId: interview.interviewId } });
      // A second tab got there first: keep its interview, drop this one.
      if (linked.count === 0) await this.prisma.interview.delete({ where: { id: interview.interviewId } });
    }
    // The candidate answers the recording question each time they join; the latest answer holds.
    const data: Prisma.InterviewSlotUpdateInput = side === 'candidate'
      ? { candidateJoinedAt: row.candidateJoinedAt ?? now, consentRecording: input.consentRecording === true }
      : { interviewerJoinedAt: row.interviewerJoinedAt ?? now };
    row = await this.prisma.interviewSlot.update({ where: { id: slotId }, data, select: slotSelect });
    if (first) await this.audit.record({ action: 'call.joined', targetType: 'interview_slot', targetId: slotId, candidateId, actorRole: role });

    const room = `slot-${slotId}`;
    const token = liveKitToken({
      apiKey: livekit.apiKey,
      apiSecret: livekit.apiSecret,
      identity: side,
      name: side === 'candidate' ? 'Candidate' : 'Interviewer',
      room,
      ttlSeconds: (rejoinUntil(row).getTime() - now.getTime()) / 1000,
      now,
    });
    return {
      slotId, side, url: livekit.url, token, room, waitUntil: waitUntil(row).toISOString(),
      interviewId: side === 'interviewer' ? row.interviewId : null,
    };
  }

  private liveKit(): { url: string; apiKey: string; apiSecret: string } | null {
    const url = this.config.get<string>('LIVEKIT_URL');
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null;
  }

  private timeZone(): string {
    return this.config.get<string>('INTERVIEW_TIME_ZONE') || 'Asia/Almaty';
  }

  private async find(slotId: string): Promise<SlotRow> {
    const row = await this.prisma.interviewSlot.findUnique({ where: { id: slotId }, select: slotSelect });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Interview slot was not found.' });
    return row;
  }

  private toDto(row: SlotRow, role: ApiRole, now: Date): InterviewSlotDto {
    return {
      slotId: row.id,
      interviewerRef: row.interviewerRef,
      startsAt: row.startsAt.toISOString(),
      endsAt: endsAt(row).toISOString(),
      durationMin: row.durationMin,
      waitUntil: waitUntil(row).toISOString(),
      status: slotStatus(row, now),
      candidateId: row.candidateId,
      candidateLabel: row.candidate?.label ?? null,
      candidateJoinedAt: row.candidateJoinedAt?.toISOString() ?? null,
      interviewerJoinedAt: row.interviewerJoinedAt?.toISOString() ?? null,
      missedBy: missedBy(row, now),
      consentRecording: row.consentRecording,
      // The interview is staff material; the candidate's channel has no use for its id.
      interviewId: role === 'platform' ? null : row.interviewId,
    };
  }
}
