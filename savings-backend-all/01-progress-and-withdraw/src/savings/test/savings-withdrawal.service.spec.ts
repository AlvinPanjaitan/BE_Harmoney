import {
  BadRequestException,
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
import { SavingsWithdrawal } from '../entities/savings-withdrawal.entity';
import { WithdrawDto } from '../dto/withdraw.dto';

// ─── Shared stubs ─────────────────────────────────────────────────────────────

const OWNER_ID = 'user-owner-uuid';
const OTHER_ID  = 'user-other-uuid';
const GOAL_ID   = 'goal-uuid-123';
const WDL_ID    = 'withdrawal-uuid-789';

const makeGoal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal =>
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

// ─── QueryRunner factory ──────────────────────────────────────────────────────

const buildQr = (goalStub: SavingsGoal) => {
  const qb = {
    where:   jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne:  jest.fn().mockResolvedValue(goalStub),
  };

  const manager = {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    }),
    // save: returns the second arg enriched with id + date
    save: jest.fn().mockImplementation((_Entity, data) =>
      Promise.resolve({ ...data, id: WDL_ID, date: new Date('2026-05-16T12:00:00Z') }),
    ),
    create: jest.fn().mockImplementation((_Entity, data) => ({ ...data })),
  };

  return {
    connect:           jest.fn().mockResolvedValue(undefined),
    startTransaction:  jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release:           jest.fn().mockResolvedValue(undefined),
    manager,
    _qb: qb, // exposed for per-test overrides
  };
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('SavingsService — withdraw()', () => {
  let service: SavingsService;
  let goalRepo: { findOne: jest.Mock };
  let mockQr: ReturnType<typeof buildQr>;

  const goalStub = makeGoal(); // balance 1000, target 5000

  beforeEach(async () => {
    mockQr   = buildQr(goalStub);
    goalRepo = { findOne: jest.fn().mockResolvedValue(goalStub) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsService,
        { provide: getRepositoryToken(SavingsGoal),       useValue: goalRepo },
        { provide: getRepositoryToken(SavingsProgress),   useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(SavingsWithdrawal), useValue: { findOne: jest.fn() } },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(mockQr) } },
      ],
    }).compile();

    service = module.get<SavingsService>(SavingsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Success ───────────────────────────────────────────────────────────────

  describe('success cases', () => {
    const dto: WithdrawDto = { amount: 200, note: 'Emergency repair' };

    it('returns the correct WithdrawResponseDto shape', async () => {
      const result = await service.withdraw(GOAL_ID, OWNER_ID, dto);

      expect(result).toMatchObject({
        id: WDL_ID,
        savingsId: GOAL_ID,
        type: 'WITHDRAWAL',
        amount: 200,
        note: 'Emergency repair',
        newTotalSaved: 800, // 1000 − 200
      });
      expect(result.date).toBeDefined();
    });

    it('decrements savedAmount on the goal row', async () => {
      await service.withdraw(GOAL_ID, OWNER_ID, dto);

      const saveCalls = (mockQr.manager.save as jest.Mock).mock.calls;
      const goalCall  = saveCalls.find(([E]) => E === SavingsGoal);
      expect(goalCall[1].savedAmount).toBe(800);
    });

    it('commits exactly once and never rolls back on success', async () => {
      await service.withdraw(GOAL_ID, OWNER_ID, dto);

      expect(mockQr.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQr.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('always releases the query runner (finally block)', async () => {
      await service.withdraw(GOAL_ID, OWNER_ID, dto);
      expect(mockQr.release).toHaveBeenCalledTimes(1);
    });

    it('uses current date when dto.date is omitted', async () => {
      const before = Date.now();
      const result  = await service.withdraw(GOAL_ID, OWNER_ID, { amount: 50 });
      const after   = Date.now();

      const ms = new Date(result.date).getTime();
      expect(ms).toBeGreaterThanOrEqual(before - 5_000);
      expect(ms).toBeLessThanOrEqual(after   + 5_000);
    });

    it('uses the provided dto.date when supplied', async () => {
      const iso = '2026-01-15T09:00:00Z';
      let capturedDate: Date | undefined;

      mockQr.manager.create.mockImplementation((_E, data) => {
        capturedDate = data.date;
        return { ...data };
      });

      await service.withdraw(GOAL_ID, OWNER_ID, { amount: 100, date: iso });

      expect(capturedDate?.toISOString()).toBe(new Date(iso).toISOString());
    });

    it('stores null note when note is omitted', async () => {
      let capturedNote: string | null | undefined;

      mockQr.manager.create.mockImplementation((_E, data) => {
        capturedNote = data.note;
        return { ...data };
      });

      await service.withdraw(GOAL_ID, OWNER_ID, { amount: 100 });

      expect(capturedNote).toBeNull();
    });

    it('stores a savedAmountSnapshot equal to newTotalSaved', async () => {
      let capturedSnapshot: number | undefined;

      mockQr.manager.create.mockImplementation((_E, data) => {
        capturedSnapshot = data.savedAmountSnapshot;
        return { ...data };
      });

      await service.withdraw(GOAL_ID, OWNER_ID, { amount: 300 });

      expect(capturedSnapshot).toBe(700); // 1000 − 300
    });

    it('allows exact full-balance withdrawal (savedAmount → 0)', async () => {
      const fullDto: WithdrawDto = { amount: 1000 };
      const result = await service.withdraw(GOAL_ID, OWNER_ID, fullDto);

      expect(result.newTotalSaved).toBe(0);
    });
  });

  // ── Goal reopening after withdrawal ──────────────────────────────────────

  describe('goal re-open logic', () => {
    it('reopens a completed goal when withdrawal drops balance below target', async () => {
      const completedGoal = makeGoal({ savedAmount: 5000, targetAmount: 5000, isCompleted: true });
      mockQr._qb.getOne.mockResolvedValue(completedGoal);
      goalRepo.findOne.mockResolvedValue(completedGoal);

      let savedGoal: SavingsGoal | undefined;
      mockQr.manager.save.mockImplementation((E, data) => {
        if (E === SavingsGoal) savedGoal = data as SavingsGoal;
        return Promise.resolve({ ...data, id: WDL_ID, date: new Date() });
      });

      await service.withdraw(GOAL_ID, OWNER_ID, { amount: 500 });

      expect(savedGoal?.isCompleted).toBe(false);
      expect(savedGoal?.savedAmount).toBe(4500);
    });

    it('keeps isCompleted=true when withdrawal leaves balance at/above target', async () => {
      // Overfunded goal — balance above target, withdraw a small amount
      const overfundedGoal = makeGoal({ savedAmount: 6000, targetAmount: 5000, isCompleted: true });
      mockQr._qb.getOne.mockResolvedValue(overfundedGoal);
      goalRepo.findOne.mockResolvedValue(overfundedGoal);

      let savedGoal: SavingsGoal | undefined;
      mockQr.manager.save.mockImplementation((E, data) => {
        if (E === SavingsGoal) savedGoal = data as SavingsGoal;
        return Promise.resolve({ ...data, id: WDL_ID, date: new Date() });
      });

      await service.withdraw(GOAL_ID, OWNER_ID, { amount: 500 }); // balance → 5500, still ≥ target

      expect(savedGoal?.isCompleted).toBe(true);
    });

    it('does not change isCompleted on an already-open goal', async () => {
      let savedGoal: SavingsGoal | undefined;
      mockQr.manager.save.mockImplementation((E, data) => {
        if (E === SavingsGoal) savedGoal = data as SavingsGoal;
        return Promise.resolve({ ...data, id: WDL_ID, date: new Date() });
      });

      await service.withdraw(GOAL_ID, OWNER_ID, { amount: 100 });

      expect(savedGoal?.isCompleted).toBe(false); // unchanged
    });
  });

  // ── Precision ─────────────────────────────────────────────────────────────

  describe('floating-point precision', () => {
    it('rounds newTotal to 2 decimal places', async () => {
      const precisionGoal = makeGoal({ savedAmount: 0.3 });
      mockQr._qb.getOne.mockResolvedValue(precisionGoal);
      goalRepo.findOne.mockResolvedValue(precisionGoal);

      let capturedTotal: number | undefined;
      mockQr.manager.save.mockImplementation((E, data) => {
        if (E === SavingsGoal) capturedTotal = (data as SavingsGoal).savedAmount;
        return Promise.resolve({ ...data, id: WDL_ID, date: new Date() });
      });

      await service.withdraw(GOAL_ID, OWNER_ID, { amount: 0.1 }); // 0.3 − 0.1

      // Without rounding: 0.30000000000000004 − 0.1 = 0.20000000000000004
      expect(capturedTotal).toBe(0.2);
    });
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  describe('error cases', () => {
    it('throws 404 when goal does not exist', async () => {
      goalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.withdraw('nonexistent-uuid', OWNER_ID, { amount: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not the goal owner', async () => {
      await expect(
        service.withdraw(GOAL_ID, OTHER_ID, { amount: 100 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 400 when withdrawal amount exceeds current balance', async () => {
      const lowBalanceGoal = makeGoal({ savedAmount: 100 });
      mockQr._qb.getOne.mockResolvedValue(lowBalanceGoal);
      goalRepo.findOne.mockResolvedValue(lowBalanceGoal);

      await expect(
        service.withdraw(GOAL_ID, OWNER_ID, { amount: 500 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('400 message contains the exact amounts for client display', async () => {
      const lowBalanceGoal = makeGoal({ savedAmount: 50 });
      mockQr._qb.getOne.mockResolvedValue(lowBalanceGoal);
      goalRepo.findOne.mockResolvedValue(lowBalanceGoal);

      try {
        await service.withdraw(GOAL_ID, OWNER_ID, { amount: 200 });
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toContain('200');
        expect((err as BadRequestException).message).toContain('50');
      }
    });

    it('throws 400 — not 500 — for insufficient funds (not wrapped)', async () => {
      const lowBalanceGoal = makeGoal({ savedAmount: 10 });
      mockQr._qb.getOne.mockResolvedValue(lowBalanceGoal);
      goalRepo.findOne.mockResolvedValue(lowBalanceGoal);

      const error = await service.withdraw(GOAL_ID, OWNER_ID, { amount: 999 })
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).not.toBeInstanceOf(InternalServerErrorException);
    });

    it('rolls back and throws 500 on unexpected DB error', async () => {
      mockQr.commitTransaction.mockRejectedValueOnce(new Error('DB timeout'));

      await expect(
        service.withdraw(GOAL_ID, OWNER_ID, { amount: 100 }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockQr.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('always releases query runner even after a DB error', async () => {
      mockQr.commitTransaction.mockRejectedValueOnce(new Error('network error'));

      await expect(
        service.withdraw(GOAL_ID, OWNER_ID, { amount: 100 }),
      ).rejects.toThrow();

      expect(mockQr.release).toHaveBeenCalledTimes(1);
    });

    it('never commits when 403 is thrown before transaction work', async () => {
      await expect(
        service.withdraw(GOAL_ID, OTHER_ID, { amount: 100 }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
    });
  });

  // ── Concurrent withdrawal guard ───────────────────────────────────────────

  describe('concurrent withdrawal safety', () => {
    it('re-reads balance under lock — uses locked value, not fast-path value', async () => {
      // Fast-path (findOne) returns balance 1000, but locked re-read returns 50
      // (simulating another withdrawal that committed between the two reads).
      const staleGoal  = makeGoal({ savedAmount: 1000 });
      const lockedGoal = makeGoal({ savedAmount: 50 });

      goalRepo.findOne.mockResolvedValue(staleGoal);
      mockQr._qb.getOne.mockResolvedValue(lockedGoal);

      // 500 > 50 (locked balance) → must throw even though 500 < 1000 (stale balance)
      await expect(
        service.withdraw(GOAL_ID, OWNER_ID, { amount: 500 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
