import { InterviewSlotsService } from '../src/modules/interview-slots/interview-slots.service';

const candidateId = '00000000-0000-4000-8000-00000000000a';
const otherCandidate = '00000000-0000-4000-8000-00000000000b';
const MINUTE = 60_000;
// 09:00 in Almaty, the day before the slots below.
const now = new Date('2026-09-28T04:00:00Z');
const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * MINUTE);

interface Slot {
  id: string;
  interviewerRef: string;
  startsAt: Date;
  durationMin: number;
  candidateId: string | null;
  bookedAt: Date | null;
  candidateJoinedAt: Date | null;
  interviewerJoinedAt: Date | null;
  consentRecording: boolean;
  interviewId: string | null;
}

type Where = Partial<Record<keyof Slot, unknown>> & { OR?: Where[]; startsAt?: unknown };

/** Enough of Prisma's `where` for the shapes the service uses. */
function matches(slot: Slot, where: Where = {}): boolean {
  if (where.OR) return where.OR.some((part) => matches(slot, part));
  return Object.entries(where).every(([key, value]) => {
    const field = slot[key as keyof Slot];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const range = value as { gt?: Date; gte?: Date; lt?: Date };
      const time = (field as Date).getTime();
      return (!range.gt || time > range.gt.getTime()) && (!range.gte || time >= range.gte.getTime()) && (!range.lt || time < range.lt.getTime());
    }
    return field === value;
  });
}

function harness({ livekit = true } = {}) {
  const slots: Slot[] = [];
  const withCandidate = (slot: Slot) => ({ ...slot, candidate: slot.candidateId ? { label: slot.candidateId === candidateId ? 'Candidate A' : 'Candidate B' } : null });
  const prisma = {
    candidate: { findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve([candidateId, otherCandidate].includes(where.id) ? { id: where.id } : null)) },
    interview: { delete: jest.fn().mockResolvedValue(undefined) },
    interviewSlot: {
      create: jest.fn(({ data }: { data: Partial<Slot> }) => {
        const slot: Slot = {
          id: `slot-${slots.length + 1}`, durationMin: 30, candidateId: null, bookedAt: null, candidateJoinedAt: null, interviewerJoinedAt: null,
          consentRecording: false, interviewId: null, ...data,
        } as Slot;
        slots.push(slot);
        return Promise.resolve(withCandidate(slot));
      }),
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const slot = slots.find((item) => item.id === where.id);
        return Promise.resolve(slot ? withCandidate(slot) : null);
      }),
      findMany: jest.fn(({ where }: { where: Where }) =>
        Promise.resolve(slots.filter((slot) => matches(slot, where)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).map(withCandidate))),
      update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<Slot> }) => {
        const slot = slots.find((item) => item.id === where.id)!;
        Object.assign(slot, data);
        return Promise.resolve(withCandidate(slot));
      }),
      updateMany: jest.fn(({ where, data }: { where: Where; data: Partial<Slot> }) => {
        const found = slots.filter((slot) => matches(slot, where));
        found.forEach((slot) => Object.assign(slot, data));
        return Promise.resolve({ count: found.length });
      }),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        slots.splice(slots.findIndex((slot) => slot.id === where.id), 1);
        return Promise.resolve(undefined);
      }),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  let interviews = 0;
  const interviewsService = { create: jest.fn(() => Promise.resolve({ interviewId: `interview-${++interviews}` })) };
  const env: Record<string, string> = livekit
    ? { LIVEKIT_URL: 'wss://synthetic.livekit.test', LIVEKIT_API_KEY: 'APIsynthetic', LIVEKIT_API_SECRET: 'synthetic-secret' }
    : {};
  const config = { get: (key: string) => env[key] };
  const service = new InterviewSlotsService(prisma as never, audit as never, interviewsService as never, config as never);
  /** A slot straight into the store, for states the API reaches only with time. */
  const put = (fields: Partial<Slot>) => {
    const slot: Slot = {
      id: `slot-${slots.length + 1}`, interviewerRef: 'synthetic-interviewer-a', startsAt: inMinutes(60), durationMin: 30, candidateId: null,
      bookedAt: null, candidateJoinedAt: null, interviewerJoinedAt: null, consentRecording: false, interviewId: null, ...fields,
    };
    slots.push(slot);
    return slot;
  };
  const actions = () => audit.record.mock.calls.map(([event]: [{ action: string }]) => event.action);
  return { service, prisma, audit, interviewsService, put, slots, actions };
}

beforeEach(() => jest.useFakeTimers({ now }));
afterEach(() => jest.useRealTimers());

describe('InterviewSlotsService — offering slots', () => {
  it('takes a slot in the future, and refuses one in the past or over another of the same interviewer', async () => {
    const { service, actions } = harness();
    const slot = await service.create({ startsAt: inMinutes(120).toISOString(), interviewerRef: 'synthetic-interviewer-a' }, 'interviewer');
    expect(slot).toMatchObject({ status: 'open', durationMin: 30, endsAt: inMinutes(150).toISOString(), waitUntil: inMinutes(125).toISOString(), interviewId: null });
    expect(actions()).toEqual(['slot.created']);

    await expect(service.create({ startsAt: inMinutes(-1).toISOString(), interviewerRef: 'synthetic-interviewer-a' }, 'interviewer'))
      .rejects.toMatchObject({ status: 400, response: { code: 'SLOT_IN_PAST' } });
    await expect(service.create({ startsAt: inMinutes(140).toISOString(), interviewerRef: 'synthetic-interviewer-a' }, 'interviewer'))
      .rejects.toMatchObject({ status: 409, response: { code: 'SLOT_OVERLAPS', details: { slotId: slot.slotId } } });
    // Back to back is fine, and so is another interviewer at the same time.
    await expect(service.create({ startsAt: inMinutes(150).toISOString(), interviewerRef: 'synthetic-interviewer-a' }, 'interviewer')).resolves.toBeDefined();
    await expect(service.create({ startsAt: inMinutes(120).toISOString(), interviewerRef: 'synthetic-interviewer-b' }, 'interviewer')).resolves.toBeDefined();
  });

  it('removes a slot nobody booked, and keeps one a candidate has', async () => {
    const { service, put } = harness();
    const free = put({});
    const booked = put({ startsAt: inMinutes(200), candidateId });
    await service.remove(free.id);
    await expect(service.remove(booked.id)).rejects.toMatchObject({ status: 409, response: { code: 'SLOT_BOOKED' } });
  });

  it('shows the candidate’s channel open slots and its own, never the interview id', async () => {
    const { service, put } = harness();
    put({ startsAt: inMinutes(60) });
    put({ startsAt: inMinutes(90), candidateId: otherCandidate });
    put({ startsAt: inMinutes(120), candidateId, interviewId: 'interview-1' });
    const seen = await service.list({ open: true, candidateId }, 'platform');
    expect(seen.items.map((slot) => slot.slotId)).toEqual(['slot-1', 'slot-3']);
    expect(seen.items[1].interviewId).toBeNull();
    const staff = await service.list({}, 'interviewer');
    expect(staff.items).toHaveLength(3);
    expect(staff.items[2]).toMatchObject({ candidateLabel: 'Candidate A', interviewId: 'interview-1' });
  });
});

describe('InterviewSlotsService — booking', () => {
  it('books a free slot once, and says so to anyone who comes second', async () => {
    const { service, put, actions } = harness();
    const slot = put({});
    await expect(service.book(slot.id, candidateId, 'platform')).resolves.toMatchObject({ status: 'booked', candidateId, candidateLabel: 'Candidate A' });
    // The same candidate again is the same booking.
    await expect(service.book(slot.id, candidateId, 'platform')).resolves.toMatchObject({ status: 'booked' });
    await expect(service.book(slot.id, otherCandidate, 'platform')).rejects.toMatchObject({ status: 409, response: { code: 'SLOT_TAKEN' } });
    expect(actions()).toEqual(['slot.booked']);
  });

  it('refuses a slot that has started, and a second booking while the first is coming', async () => {
    const { service, put } = harness();
    const started = put({ startsAt: inMinutes(-1) });
    await expect(service.book(started.id, candidateId, 'platform')).rejects.toMatchObject({ status: 409, response: { code: 'SLOT_PASSED' } });
    const first = put({ startsAt: inMinutes(60), candidateId });
    const second = put({ startsAt: inMinutes(24 * 60) });
    await expect(service.book(second.id, candidateId, 'platform')).rejects.toMatchObject({ status: 409, response: { code: 'ALREADY_BOOKED', details: { slotId: first.id } } });
  });

  it('after a missed slot, books only on another day', async () => {
    const { service, put } = harness();
    // Missed an hour ago, today in Almaty.
    put({ startsAt: inMinutes(-60), candidateId, interviewerJoinedAt: inMinutes(-62) });
    const laterToday = put({ startsAt: inMinutes(180) });
    const tomorrow = put({ startsAt: inMinutes(24 * 60) });
    await expect(service.book(laterToday.id, candidateId, 'platform'))
      .rejects.toMatchObject({ status: 409, response: { code: 'SAME_DAY_AS_MISSED', details: { day: '2026-09-28' } } });
    await expect(service.book(tomorrow.id, candidateId, 'platform')).resolves.toMatchObject({ status: 'booked' });
  });

  it('books nothing more once the interview has taken place', async () => {
    const { service, put } = harness();
    put({ startsAt: inMinutes(-90), candidateId, candidateJoinedAt: inMinutes(-89), interviewerJoinedAt: inMinutes(-91) });
    const next = put({ startsAt: inMinutes(24 * 60) });
    await expect(service.book(next.id, candidateId, 'platform')).rejects.toMatchObject({ status: 409, response: { code: 'ALREADY_INTERVIEWED' } });
  });
});

describe('InterviewSlotsService — joining the call', () => {
  it('answers 503 when LiveKit is not set up, and changes nothing', async () => {
    const { service, put, slots } = harness({ livekit: false });
    const slot = put({ startsAt: inMinutes(2), candidateId });
    await expect(service.join(slot.id, { consentRecording: true }, 'platform')).rejects.toMatchObject({ status: 503, response: { code: 'VIDEO_UNAVAILABLE' } });
    expect(slots[0].candidateJoinedAt).toBeNull();
  });

  it('opens the door ten minutes before the start, and only for a booked slot', async () => {
    const { service, put } = harness();
    const early = put({ startsAt: inMinutes(11), candidateId });
    await expect(service.join(early.id, {}, 'platform'))
      .rejects.toMatchObject({ status: 409, response: { code: 'TOO_EARLY', details: { opensAt: inMinutes(1).toISOString() } } });
    const free = put({ startsAt: inMinutes(120) });
    await expect(service.join(free.id, {}, 'interviewer')).rejects.toMatchObject({ status: 409, response: { code: 'SLOT_NOT_BOOKED' } });
  });

  it('gives the candidate a token for their side, and keeps their answer about recording', async () => {
    const { service, put, slots, actions } = harness();
    const slot = put({ startsAt: inMinutes(5), candidateId });
    const access = await service.join(slot.id, { consentRecording: true }, 'platform');
    expect(access).toMatchObject({ side: 'candidate', url: 'wss://synthetic.livekit.test', room: `slot-${slot.id}`, interviewId: null });
    const claims = JSON.parse(Buffer.from(access.token.split('.')[1], 'base64url').toString());
    expect(claims).toMatchObject({ sub: 'candidate', name: 'Candidate', video: { room: `slot-${slot.id}` } });
    // Valid until thirty minutes after the end: 5 + 30 + 30 minutes from now.
    expect(claims.exp - claims.nbf).toBe(65 * 60);
    expect(slots[0]).toMatchObject({ candidateJoinedAt: now, consentRecording: true });

    // Rejoining after a dropped connection keeps the first time, takes the new answer, and writes no second audit line.
    jest.setSystemTime(inMinutes(6));
    await service.join(slot.id, { consentRecording: false }, 'platform');
    expect(slots[0]).toMatchObject({ candidateJoinedAt: now, consentRecording: false });
    expect(actions()).toEqual(['call.joined']);
  });

  it('makes the interview when the interviewer first joins, and only once', async () => {
    const { service, put, interviewsService } = harness();
    const slot = put({ startsAt: inMinutes(3), candidateId });
    const first = await service.join(slot.id, {}, 'interviewer');
    const again = await service.join(slot.id, {}, 'interviewer');
    expect(first).toMatchObject({ side: 'interviewer', interviewId: 'interview-1' });
    expect(again.interviewId).toBe('interview-1');
    expect(interviewsService.create).toHaveBeenCalledTimes(1);
    expect(interviewsService.create).toHaveBeenCalledWith(
      { candidateId, heldAt: slot.startsAt.toISOString(), interviewerRef: 'synthetic-interviewer-a' }, 'interviewer');
  });

  it('closes the door five minutes after the start when the other side has not come', async () => {
    const { service, put } = harness();
    const slot = put({ startsAt: inMinutes(-5), candidateId, interviewerJoinedAt: inMinutes(-7) });
    await expect(service.join(slot.id, { consentRecording: true }, 'platform'))
      .rejects.toMatchObject({ status: 409, response: { code: 'SLOT_MISSED', details: { missedBy: 'candidate' } } });
    await expect(service.get(slot.id, 'platform')).resolves.toMatchObject({ status: 'missed', missedBy: 'candidate' });
  });

  it('lets a dropped call back in after both came, until thirty minutes after the end', async () => {
    const { service, put } = harness();
    const slot = put({ startsAt: inMinutes(-40), candidateId, candidateJoinedAt: inMinutes(-39), interviewerJoinedAt: inMinutes(-41), interviewId: 'interview-9' });
    await expect(service.join(slot.id, {}, 'interviewer')).resolves.toMatchObject({ interviewId: 'interview-9' });
    jest.setSystemTime(inMinutes(21));
    await expect(service.join(slot.id, {}, 'interviewer')).rejects.toMatchObject({ status: 409, response: { code: 'SLOT_OVER' } });
  });
});
