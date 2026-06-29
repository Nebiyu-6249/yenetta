import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressService } from './progress.service';

function makeService(existingMastery?: number) {
  const prisma = {
    userProgress: {
      findUnique: vi
        .fn()
        .mockResolvedValue(existingMastery === undefined ? null : { mastery: existingMastery }),
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn(),
    },
  };
  return { service: new ProgressService(prisma as never), prisma };
}

describe('ProgressService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the raw score as mastery the first time', async () => {
    const { service, prisma } = makeService();
    await service.recordResult('u1', 'c1', 0.8);
    expect(prisma.userProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ mastery: 0.8 }) }),
    );
  });

  it('blends new results into existing mastery (EMA)', async () => {
    const { service, prisma } = makeService(0.5);
    await service.recordResult('u1', 'c1', 1);
    const call = prisma.userProgress.upsert.mock.calls[0]![0];
    expect(call.update.mastery).toBeCloseTo(0.5 * 0.6 + 1 * 0.4, 5); // 0.7
  });

  it('derives weak areas from low mastery', async () => {
    const { service, prisma } = makeService();
    prisma.userProgress.findMany.mockResolvedValue([
      { chapterId: 'c1', mastery: 0.9, lastStudied: null },
      { chapterId: 'c2', mastery: 0.3, lastStudied: null },
    ]);
    const summary = await service.getSummary('u1');
    expect(summary.weakAreas).toEqual([{ chapterId: 'c2', mastery: 0.3 }]);
  });
});
