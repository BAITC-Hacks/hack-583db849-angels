import { RetentionService } from '../src/modules/retention/retention.service';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-01T12:00:00Z');

function harness(days?: string) {
  const questions = [
    { id: 'old', candidateId: 'c-old', videoRef: 'surprise/old/answer.webm', decidedAt: new Date(now.getTime() - 31 * DAY) },
    { id: 'recent', candidateId: 'c-recent', videoRef: 'surprise/recent/answer.webm', decidedAt: new Date(now.getTime() - 10 * DAY) },
    { id: 'undecided', candidateId: 'c-open', videoRef: 'surprise/open/answer.webm', decidedAt: null },
  ];
  const prisma = {
    candidate: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(where.id === 'c-old' ? { id: 'c-old' } : null)),
      update: jest.fn().mockResolvedValue({}),
    },
    surpriseQuestion: {
      findMany: jest.fn(({ where }: { where: { candidate: { decidedAt: { lte: Date } } } }) =>
        Promise.resolve(questions.filter((question) => question.videoRef && question.decidedAt && question.decidedAt <= where.candidate.decidedAt.lte))),
      update: jest.fn(({ where }: { where: { id: string } }) => {
        const question = questions.find((item) => item.id === where.id)!;
        question.videoRef = null as never;
        return Promise.resolve(question);
      }),
    },
  };
  const media = { delete: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (name: string) => (name === 'VIDEO_RETENTION_DAYS' ? days : undefined) };
  return { service: new RetentionService(prisma as never, config as never, media as never, audit as never), prisma, media, audit, questions };
}

describe('RetentionService', () => {
  it('deletes only the videos of candidates decided 30 days ago or more, and keeps the rest', async () => {
    const { service, media, audit, questions } = harness();
    await expect(service.sweep(now)).resolves.toBe(1);
    expect(media.delete).toHaveBeenCalledTimes(1);
    expect(media.delete).toHaveBeenCalledWith('surprise/old/answer.webm');
    expect(questions.map((question) => question.videoRef)).toEqual([null, 'surprise/recent/answer.webm', 'surprise/open/answer.webm']);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'surprise.video.deleted', targetId: 'old', candidateId: 'c-old' }));
    // A second sweep finds nothing left to delete.
    await expect(service.sweep(now)).resolves.toBe(0);
  });

  it('takes the period from VIDEO_RETENTION_DAYS', async () => {
    const { service } = harness('7');
    await expect(service.sweep(now)).resolves.toBe(2);
  });

  it('records the date of the decision and when the videos go, never anything about the decision itself', async () => {
    const { service, prisma } = harness();
    const decided = await service.setDecisionDate('c-old', '2026-09-01T09:00:00Z', 'platform');
    expect(decided).toEqual({ candidateId: 'c-old', decidedAt: '2026-09-01T09:00:00.000Z', videosDeletedAfter: '2026-10-01T09:00:00.000Z' });
    expect(prisma.candidate.update).toHaveBeenCalledWith({ where: { id: 'c-old' }, data: { decidedAt: new Date('2026-09-01T09:00:00Z') } });
  });

  it('refuses a decision date in the future, and an unknown candidate', async () => {
    const { service } = harness();
    await expect(service.setDecisionDate('c-old', new Date(Date.now() + 2 * DAY).toISOString(), 'platform'))
      .rejects.toMatchObject({ status: 400, response: { details: { fields: ['decidedAt'] } } });
    await expect(service.setDecisionDate('nobody', '2026-09-01T00:00:00Z', 'platform')).rejects.toMatchObject({ status: 404 });
  });
});
