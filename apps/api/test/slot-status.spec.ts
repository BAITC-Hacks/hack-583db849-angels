import { dayKey, missedBy, opensAt, rejoinUntil, slotStatus, waitUntil } from '../src/modules/interview-slots/slot-status';

const startsAt = new Date('2026-09-29T05:00:00Z');
const at = (minutes: number) => new Date(startsAt.getTime() + minutes * 60_000);
const slot = (fields: Partial<{ candidateId: string | null; candidateJoinedAt: Date | null; interviewerJoinedAt: Date | null }> = {}) => ({
  startsAt, durationMin: 30, candidateId: 'candidate', candidateJoinedAt: null, interviewerJoinedAt: null, ...fields,
});

describe('where an interview slot is', () => {
  it('is open until its start, then closed, while nobody has booked it', () => {
    expect(slotStatus(slot({ candidateId: null }), at(-1))).toBe('open');
    expect(slotStatus(slot({ candidateId: null }), at(0))).toBe('closed');
  });

  it('waits five minutes after the start for both sides, then is missed', () => {
    expect(slotStatus(slot(), at(-1))).toBe('booked');
    expect(slotStatus(slot({ interviewerJoinedAt: at(-2) }), at(4.9))).toBe('waiting');
    expect(slotStatus(slot({ interviewerJoinedAt: at(-2) }), at(5))).toBe('missed');
    expect(missedBy(slot({ interviewerJoinedAt: at(-2) }), at(5))).toBe('candidate');
    expect(missedBy(slot({ candidateJoinedAt: at(1) }), at(6))).toBe('interviewer');
    expect(missedBy(slot(), at(6))).toBe('both');
    expect(missedBy(slot(), at(4))).toBeNull();
  });

  it('is live once both have joined, and done after its end', () => {
    const both = slot({ candidateJoinedAt: at(4), interviewerJoinedAt: at(1) });
    expect(slotStatus(both, at(10))).toBe('live');
    expect(slotStatus(both, at(30))).toBe('done');
    expect(missedBy(both, at(30))).toBeNull();
  });

  it('opens the door ten minutes early and lets a dropped call back in for thirty minutes after the end', () => {
    expect(opensAt(slot()).toISOString()).toBe(at(-10).toISOString());
    expect(waitUntil(slot()).toISOString()).toBe(at(5).toISOString());
    expect(rejoinUntil(slot()).toISOString()).toBe(at(60).toISOString());
  });

  it('counts days in the admissions office’s time zone', () => {
    // 20:30 UTC is already the next morning in Almaty (UTC+5).
    expect(dayKey(new Date('2026-09-29T20:30:00Z'), 'Asia/Almaty')).toBe('2026-09-30');
    expect(dayKey(new Date('2026-09-29T18:30:00Z'), 'Asia/Almaty')).toBe('2026-09-29');
  });
});
