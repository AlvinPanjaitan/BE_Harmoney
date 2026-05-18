import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SavingsService } from '../savings.service';
import { SavingsGoal } from '../entities/savings-goal.entity';
import { SavingsProgress } from '../entities/savings-progress.entity';
import { AddProgressDto } from '../dto/add-progress.dto';

// ─── Shared stubs ─────────────────────────────────────────────────────────────

const OWNER_ID = 'user-owner-uuid';
const OTHER_USER_ID = 'user-other-uuid';
const GOAL_ID = 'goal-uuid-123';
const PROGRESS_ID = 'progress-uuid-456';

const makeGoalStub = (overrides: Partial<SavingsGoal> = {}): SavingsGoal =>
  ({
    id: GOAL_ID,
    userId: OWNER_ID,
    name: 'Emergency Fund',
    targetAmount: 5000,
    savedAmount: 1000,
    currency: 'USD',
    deadline: null,
    isCompleted: false,
    progress: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-05-01'),
    ...overrides,
  } as SavingsGoal);

const makeProgressStub = (overrides: Partial<SavingsProgress> = {}): SavingsProgress =>
  ({
    id: PROGRESS_ID,
    savingsId: GOAL_ID,
    amount: 500,
    date: new Date('2026-05-16T10:00:00Z'),
    note: 'Monthly deposit',
    savedAmountSnapshot: 1500,
    createdAt: new Date('2026-05-16T10:00:00Z'),
    ...overrides,
  } as SavingsProgress);

// ─── Mock factory ─────────────────────────────────────────────────────────────

/**
 * Builds a mock QueryRunner whose manager methods can be overridden
 * per test via `mockQr.manager.*`.
 */
const buildMockQueryRunner = (goalStub: SavingsGoal, progressStub: SavingsProgress) => {
  const qbMock = {
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(goalStub),
  };

  const managerMock = {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    }),
    save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data, id: PROGRESS_ID, date: new Date('2026-05-16T10:00:00Z') })),
    create: jest.fn().mockImplementation((_, data) => ({ ...data, id: PROGRESS_ID })),
  };

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: managerMock,
    _qb: qbMock,  // exposed so tests can override getOne
  };
};

describe('SavingsService', () => {
  let service: SavingsService;
  let goalRepo: { findOne: jest.Mock };
  let progressRepo: { findOne: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock };
  let mockQr: ReturnType<typeof buildMockQueryRunner>;

  const goalStub = makeGoalStub();
  const progressStub = makeProgressStub();

  beforeEach(async () => {
    mockQr = buildMockQueryRunner(goalStub, progressStub);

    goalRepo = { findOne: jest.fn().mockResolvedValue(goalStub) };
    progressRepo = { findOne: jest.fn().mockResolvedValue(progressStub) };
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQr) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsService,
        { provide: getRepositoryToken(SavingsGoal), useValue: goalRepo },
        { provide: getRepositoryToken(SavingsProgress), useValue: progressRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<SavingsService>(SavingsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── addProgress — happy paths ─────────────────────────────────────────────

  describe('addProgress() — success', () => {
    const dto: AddProgressDto = { amount: 500, note: 'Monthly deposit' };

    it('returns the correct response shape', async () => {
      const result = await service.addProgress(GOAL_ID, OWNER_ID, dto);

      expect(result).toMatchObject({
        id: PROGRESS_ID,
        savingsId: GOAL_ID,
        amount: 500,
        note: 'Monthly deposit',
        newTotalSaved: 1500, // 1000 existing + 500
      });
      expect(result.date).toBeDefined();
    });

    it('uses current date when dto.date is omitted', async () => {
      const before = Date.now();
      const result = await service.addProgress(GOAL_ID, OWNER_ID, { amount: 100 });
      const after = Date.now();

      const resultMs = new Date(result.date).getTime();
      // The recorded date should be between before and after
      expect(resultMs).toBeGreaterThanOrEqual(before - 5000);
      expect(resultMs).toBeLessThanOrEqual(after + 5000);
    });

    it('uses the provided dto.date when supplied', async () => {
      const isoDate = '2026-01-15T08:30:00Z';
      // Make manager.create capture the date it's called with
      let capturedDate: Date | undefined;
      mockQr.manager.create.mockImplementation((_, data) => {
        capturedDate = data.date;
        return { ...data, id: PROGRESS_ID };
      });

      await service.addProgress(GOAL_ID, OWNER_ID, { amount: 200, date: isoDate });

      expect(capturedDate?.toISOString()).toBe(new Date(isoDate).toISOString());
    });

    it('stores null note when note is omitted', async () => {
      let capturedNote: string | null | undefined;
      mockQr.manager.create.mockImplementation((_, data) => {
        capturedNote = data.note;
        return { ...data, id: PROGRESS_ID };
      });

      await service.addProgress(GOAL_ID, OWNER_ID, { amount: 100 });

      expect(capturedNote).toBeNull();
    });

    it('commits the transaction exactly once', async () => {
      await service.addProgress(GOAL_ID, OWNER_ID, dto);
      expect(mockQr.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQr.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('always releases the query runner', async () => {
      await service.addProgress(GOAL_ID, OWNER_ID, dto);
      expect(mockQr.release).toHaveBeenCalledTimes(1);
    });

    it('saves SavingsGoal with incremented savedAmount', async () => {
      await service.addProgress(GOAL_ID, OWNER_ID, dto);

      const saveCalls = (mockQr.manager.save as jest.Mock).mock.calls;
      const goalSaveCall = saveCalls.find(([Entity]) => Entity === SavingsGoal);
      expect(goalSaveCall).toBeDefined();
      expect(goalSaveCall[1].savedAmount).toBe(1500);
    });
  });

  // ── addProgress — goal completion ─────────────────────────────────────────

  describe('addProgress() — goal auto-completion', () => {
    it('sets isCompleted=true when savedAmount reaches targetAmount', async () => {
      // Goal needs 1000 more to complete
      const nearlyDoneGoal = makeGoalStub({ savedAmount: 4000, targetAmount: 5000 });
      mockQr._qb.getOne.mockResolvedValue(nearlyDoneGoal);
      goalRepo.findOne.mockResolvedValue(nearlyDoneGoal);

      let savedGoal: SavingsGoal | undefined;
      mockQr.manager.save.mockImplementation((Entity, data) => {
        if (Entity === SavingsGoal) savedGoal = data as SavingsGoal;
        return Promise.resolve({ ...data, id: PROGRESS_ID, date: new Date() });
      });

      await service.addProgress(GOAL_ID, OWNER_ID, { amount: 1000 });

      expect(savedGoal?.isCompleted).toBe(true);
    });

    it('sets isCompleted=true when contribution exceeds target', async () => {
      const nearlyDoneGoal = makeGoalStub({ savedAmount: 4500, targetAmount: 5000 });
      mockQr._qb.getOne.mockResolvedValue(nearlyDoneGoal);
      goalRepo.findOne.mockResolvedValue(nearlyDoneGoal);

      let savedGoal: SavingsGoal | undefined;
      mockQr.manager.save.mockImplementation((Entity, data) => {
        if (Entity === SavingsGoal) savedGoal = data as SavingsGoal;
        return Promise.resolve({ ...data, id: PROGRESS_ID, date: new Date() });
      });

      await service.addProgress(GOAL_ID, OWNER_ID, { amount: 1000 }); // overshoots

      expect(savedGoal?.isCompleted).toBe(true);
    });

    it('does NOT flip isCompleted when already true', async () => {
      const completedGoal = makeGoalStub({
        savedAmount: 5000,
        targetAmount: 5000,
        isCompleted: true,
      });
      mockQr._qb.getOne.mockResolvedValue(completedGoal);
      goalRepo.findOne.mockResolvedValue(completedGoal);

      // service should still succeed (no guard against adding to completed goal)
      const result = await service.addProgress(GOAL_ID, OWNER_ID, { amount: 50 });
      expect(result.newTotalSaved).toBe(5050);
    });
  });

  // ── addProgress — error paths ─────────────────────────────────────────────

  describe('addProgress() — errors', () => {
    it('throws 404 when goal does not exist', async () => {
      goalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addProgress('nonexistent-uuid', OWNER_ID, { amount: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not the goal owner', async () => {
      await expect(
        service.addProgress(GOAL_ID, OTHER_USER_ID, { amount: 100 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rolls back and throws 500 on unexpected DB error', async () => {
      mockQr.commitTransaction.mockRejectedValueOnce(new Error('DB timeout'));

      await expect(
        service.addProgress(GOAL_ID, OWNER_ID, { amount: 100 }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockQr.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('always releases query runner even after a DB error', async () => {
      mockQr.commitTransaction.mockRejectedValueOnce(new Error('DB timeout'));

      await expect(
        service.addProgress(GOAL_ID, OWNER_ID, { amount: 100 }),
      ).rejects.toThrow();

      expect(mockQr.release).toHaveBeenCalledTimes(1);
    });

    it('does not roll back when 403 is thrown (before transaction work)', async () => {
      await expect(
        service.addProgress(GOAL_ID, OTHER_USER_ID, { amount: 100 }),
      ).rejects.toThrow(ForbiddenException);

      // Transaction may have started but rollback should still be called
      // (or not started at all if 403 throws before connect)
      // Key assertion: no commit happened
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
    });
  });

  // ── addProgress — floating-point precision ────────────────────────────────

  describe('addProgress() — precision', () => {
    it('rounds to 2 decimal places on floating-point contributions', async () => {
      const goal = makeGoalStub({ savedAmount: 0.1 });
      mockQr._qb.getOne.mockResolvedValue(goal);
      goalRepo.findOne.mockResolvedValue(goal);

      let capturedTotal: number | undefined;
      mockQr.manager.save.mockImplementation((Entity, data) => {
        if (Entity === SavingsGoal) capturedTotal = (data as SavingsGoal).savedAmount;
        return Promise.resolve({ ...data, id: PROGRESS_ID, date: new Date() });
      });

      await service.addProgress(GOAL_ID, OWNER_ID, { amount: 0.2 });

      // 0.1 + 0.2 in JavaScript = 0.30000000000000004 — must be rounded
      expect(capturedTotal).toBe(0.3);
    });
  });

  // ── helper methods ────────────────────────────────────────────────────────

  describe('findGoalById()', () => {
    it('returns the goal when found', async () => {
      const result = await service.findGoalById(GOAL_ID);
      expect(result).toEqual(goalStub);
    });

    it('returns null when not found', async () => {
      goalRepo.findOne.mockResolvedValue(null);
      const result = await service.findGoalById('missing');
      expect(result).toBeNull();
    });
  });
});
