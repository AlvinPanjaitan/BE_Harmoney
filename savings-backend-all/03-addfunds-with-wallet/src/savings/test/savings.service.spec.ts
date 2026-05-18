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
import { Savings } from '../entities/savings.entity';
import { WalletService } from '../../wallet/wallet.service';
import { Wallet } from '../../wallet/entities/wallet.entity';

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID       = 'user-owner-uuid';
const OTHER_USER_ID = 'user-other-uuid';
const SAVING_ID     = 1;
const OWNER_WALLET  = 10;
const SOURCE_WALLET = 11;

// ─── Stubs ────────────────────────────────────────────────────────────────────

const makeSavings = (overrides: Partial<Savings> = {}): Savings =>
  ({
    savingId: SAVING_ID,
    walletId: OWNER_WALLET,
    name: 'Vacation Fund',
    targetAmount: 1000,
    currentAmount: 250,
    startDate: new Date('2025-01-01'),
    endDate:   new Date('2030-12-31'),
    wallet: undefined as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Savings);

const makeWallet = (overrides: Partial<Wallet> = {}): Wallet =>
  ({
    walletId: OWNER_WALLET,
    userId: USER_ID,
    name: 'Default',
    balance: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Wallet);

// ─── QueryRunner / DataSource factory ─────────────────────────────────────────

const buildQueryRunner = (savingsStub: Savings, ownerWallet: Wallet) => {
  const qb = {
    where:   jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne:  jest.fn().mockResolvedValue(savingsStub),
  };

  const manager: any = {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    }),
    findOne: jest.fn().mockResolvedValue(ownerWallet),
    save:    jest.fn().mockImplementation((_E, data) => Promise.resolve(data)),
  };

  return {
    connect:             jest.fn().mockResolvedValue(undefined),
    startTransaction:    jest.fn().mockResolvedValue(undefined),
    commitTransaction:   jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release:             jest.fn().mockResolvedValue(undefined),
    manager,
    _qb: qb,
  };
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SavingsService', () => {
  let service: SavingsService;
  let savingsRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let walletService: {
    findOne: jest.Mock;
    debitInTransaction: jest.Mock;
  };
  let dataSource: { createQueryRunner: jest.Mock };
  let qr: ReturnType<typeof buildQueryRunner>;

  const savingsStub = makeSavings();
  const ownerWalletStub = makeWallet({ walletId: OWNER_WALLET });

  beforeEach(async () => {
    qr = buildQueryRunner(savingsStub, ownerWalletStub);

    savingsRepo = {
      findOne: jest.fn(),
      create:  jest.fn(),
      save:    jest.fn(),
    };
    walletService = {
      findOne: jest.fn(),
      debitInTransaction: jest.fn().mockResolvedValue(makeWallet({ walletId: SOURCE_WALLET })),
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(qr),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsService,
        { provide: getRepositoryToken(Savings), useValue: savingsRepo },
        { provide: WalletService, useValue: walletService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<SavingsService>(SavingsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ═══════════════════════════════════════════════════════════════════════════
  // addFunds()  — the most complex method
  // ═══════════════════════════════════════════════════════════════════════════

  describe('addFunds()', () => {

    // ─── Success path ──────────────────────────────────────────────────────

    describe('success', () => {
      it('debits the source wallet and credits the savings goal', async () => {
        await service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID);

        expect(walletService.debitInTransaction).toHaveBeenCalledWith(
          qr,
          SOURCE_WALLET,
          100,
          USER_ID,
        );

        const saveCalls = (qr.manager.save as jest.Mock).mock.calls;
        const savingsSave = saveCalls.find(([E]) => E === Savings);
        expect(savingsSave).toBeDefined();
        expect(savingsSave[1].currentAmount).toBe(350); // 250 + 100
      });

      it('commits the transaction exactly once on success', async () => {
        await service.addFunds(SAVING_ID, 50, SOURCE_WALLET, USER_ID);

        expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
        expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      });

      it('uses a row-level lock when loading the savings goal', async () => {
        await service.addFunds(SAVING_ID, 50, SOURCE_WALLET, USER_ID);

        expect(qr._qb.setLock).toHaveBeenCalledWith('pessimistic_write');
      });

      it('always releases the query runner (finally block)', async () => {
        await service.addFunds(SAVING_ID, 50, SOURCE_WALLET, USER_ID);

        expect(qr.release).toHaveBeenCalledTimes(1);
      });

      it('returns void (no payload)', async () => {
        const result = await service.addFunds(SAVING_ID, 50, SOURCE_WALLET, USER_ID);
        expect(result).toBeUndefined();
      });

      it('handles floating-point arithmetic safely (0.1 + 0.2)', async () => {
        const goal = makeSavings({ currentAmount: 0.1 });
        qr._qb.getOne.mockResolvedValue(goal);

        let captured: number | undefined;
        qr.manager.save.mockImplementation((E, data) => {
          if (E === Savings) captured = (data as Savings).currentAmount;
          return Promise.resolve(data);
        });

        await service.addFunds(SAVING_ID, 0.2, SOURCE_WALLET, USER_ID);

        // Naive arithmetic would give 0.30000000000000004 — service rounds.
        expect(captured).toBe(0.3);
      });
    });

    // ─── 400 BadRequest ────────────────────────────────────────────────────

    describe('validation — 400 BadRequest', () => {
      it('rejects amount = 0', async () => {
        await expect(
          service.addFunds(SAVING_ID, 0, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects negative amount', async () => {
        await expect(
          service.addFunds(SAVING_ID, -50, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects NaN amount', async () => {
        await expect(
          service.addFunds(SAVING_ID, NaN, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(BadRequestException);
      });

      it('does not open a transaction when amount is invalid', async () => {
        await expect(
          service.addFunds(SAVING_ID, 0, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow();

        expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      });

      it('rejects when the goal has not started yet (now < startDate)', async () => {
        const future = makeSavings({
          startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endDate:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        qr._qb.getOne.mockResolvedValue(future);

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects when the goal has already ended (now > endDate)', async () => {
        const past = makeSavings({
          startDate: new Date('2020-01-01'),
          endDate:   new Date('2020-12-31'),
        });
        qr._qb.getOne.mockResolvedValue(past);

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(BadRequestException);
      });

      it('propagates insufficient-funds 400 from WalletService', async () => {
        walletService.debitInTransaction.mockRejectedValueOnce(
          new BadRequestException('Insufficient balance: wallet has 10, attempted to debit 100.'),
        );

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(BadRequestException);
      });
    });

    // ─── 404 NotFound ──────────────────────────────────────────────────────

    describe('not-found — 404', () => {
      it('throws 404 when the savings goal does not exist', async () => {
        qr._qb.getOne.mockResolvedValue(null);

        await expect(
          service.addFunds(999, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(NotFoundException);
      });

      it('throws 404 when the owner wallet linked to the goal is missing', async () => {
        qr.manager.findOne.mockResolvedValue(null); // owner wallet missing

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(NotFoundException);
      });

      it('propagates 404 from WalletService when source wallet missing', async () => {
        walletService.debitInTransaction.mockRejectedValueOnce(
          new NotFoundException(`Wallet '${SOURCE_WALLET}' not found.`),
        );

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── 403 Forbidden ─────────────────────────────────────────────────────

    describe('ownership — 403 Forbidden', () => {
      it('throws 403 when caller does not own the savings goal', async () => {
        const ownerOfDifferentUser = makeWallet({ userId: 'someone-else' });
        qr.manager.findOne.mockResolvedValue(ownerOfDifferentUser);

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(ForbiddenException);
      });

      it('propagates 403 from WalletService when source wallet belongs to another user', async () => {
        walletService.debitInTransaction.mockRejectedValueOnce(
          new ForbiddenException("Wallet '11' does not belong to the authenticated user."),
        );

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, OTHER_USER_ID),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    // ─── Rollback / 500 ────────────────────────────────────────────────────

    describe('rollback behaviour', () => {
      it('rolls back on 404 from the wallet service', async () => {
        walletService.debitInTransaction.mockRejectedValueOnce(
          new NotFoundException('Source wallet not found.'),
        );

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(NotFoundException);

        expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
        expect(qr.commitTransaction).not.toHaveBeenCalled();
      });

      it('rolls back and wraps unexpected DB errors as 500', async () => {
        qr.commitTransaction.mockRejectedValueOnce(new Error('DB timeout'));

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow(InternalServerErrorException);

        expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
      });

      it('releases the query runner even on rollback', async () => {
        qr.commitTransaction.mockRejectedValueOnce(new Error('boom'));

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow();

        expect(qr.release).toHaveBeenCalledTimes(1);
      });

      it('never commits when the source-wallet debit fails', async () => {
        walletService.debitInTransaction.mockRejectedValueOnce(
          new BadRequestException('Insufficient balance.'),
        );

        await expect(
          service.addFunds(SAVING_ID, 100, SOURCE_WALLET, USER_ID),
        ).rejects.toThrow();

        expect(qr.commitTransaction).not.toHaveBeenCalled();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateProgress()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('calculateProgress()', () => {
    it('returns currentAmount / targetAmount for a normal goal', async () => {
      savingsRepo.findOne.mockResolvedValue(
        makeSavings({ targetAmount: 1000, currentAmount: 750 }),
      );

      const result = await service.calculateProgress(SAVING_ID);

      expect(result).toBe(0.75);
    });

    it('rounds to 4 decimal places to avoid float noise', async () => {
      savingsRepo.findOne.mockResolvedValue(
        makeSavings({ targetAmount: 3, currentAmount: 1 }),
      );

      const result = await service.calculateProgress(SAVING_ID);

      // 1/3 = 0.333333... — service rounds to 0.3333
      expect(result).toBe(0.3333);
    });

    it('returns 0 when targetAmount is 0 (avoids division by zero)', async () => {
      savingsRepo.findOne.mockResolvedValue(
        makeSavings({ targetAmount: 0, currentAmount: 100 }),
      );

      const result = await service.calculateProgress(SAVING_ID);

      expect(result).toBe(0);
    });

    it('returns 0 when targetAmount is negative (defensive)', async () => {
      savingsRepo.findOne.mockResolvedValue(
        makeSavings({ targetAmount: -100, currentAmount: 50 }),
      );

      const result = await service.calculateProgress(SAVING_ID);

      expect(result).toBe(0);
    });

    it('returns 0 when currentAmount is 0', async () => {
      savingsRepo.findOne.mockResolvedValue(
        makeSavings({ targetAmount: 1000, currentAmount: 0 }),
      );

      const result = await service.calculateProgress(SAVING_ID);

      expect(result).toBe(0);
    });

    it('returns 0 when currentAmount is negative (defensive)', async () => {
      savingsRepo.findOne.mockResolvedValue(
        makeSavings({ targetAmount: 1000, currentAmount: -10 }),
      );

      const result = await service.calculateProgress(SAVING_ID);

      expect(result).toBe(0);
    });

    it('returns a value > 1 when the goal is overfunded', async () => {
      savingsRepo.findOne.mockResolvedValue(
        makeSavings({ targetAmount: 1000, currentAmount: 1500 }),
      );

      const result = await service.calculateProgress(SAVING_ID);

      expect(result).toBe(1.5);
    });

    it('returns exactly 1 when fully funded', async () => {
      savingsRepo.findOne.mockResolvedValue(
        makeSavings({ targetAmount: 500, currentAmount: 500 }),
      );

      const result = await service.calculateProgress(SAVING_ID);

      expect(result).toBe(1);
    });

    it('throws 404 when the savings goal does not exist', async () => {
      savingsRepo.findOne.mockResolvedValue(null);

      await expect(service.calculateProgress(999))
        .rejects.toThrow(NotFoundException);
    });

    it('handles values coming back as strings from PostgreSQL', async () => {
      // PostgreSQL numeric/double columns can be returned as strings by some drivers.
      // The service casts via Number() so this must still work.
      savingsRepo.findOne.mockResolvedValue({
        ...makeSavings(),
        targetAmount: '1000' as any,
        currentAmount: '250' as any,
      });

      const result = await service.calculateProgress(SAVING_ID);

      expect(result).toBe(0.25);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // create() — CRUD helper
  // ═══════════════════════════════════════════════════════════════════════════

  describe('create()', () => {
    const dto = {
      walletId: OWNER_WALLET,
      name: 'New Goal',
      targetAmount: 5000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };

    it('creates a goal when the wallet belongs to the caller', async () => {
      walletService.findOne.mockResolvedValue(makeWallet());
      savingsRepo.create.mockReturnValue(makeSavings());
      savingsRepo.save.mockResolvedValue(makeSavings());

      const result = await service.create(USER_ID, dto);

      expect(savingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currentAmount: 0 }),
      );
      expect(result).toBeDefined();
    });

    it('throws 404 when the linked wallet does not exist', async () => {
      walletService.findOne.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto))
        .rejects.toThrow(NotFoundException);
    });

    it('throws 403 when the linked wallet belongs to someone else', async () => {
      walletService.findOne.mockResolvedValue(
        makeWallet({ userId: 'someone-else' }),
      );

      await expect(service.create(USER_ID, dto))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws 400 when endDate is not strictly after startDate', async () => {
      walletService.findOne.mockResolvedValue(makeWallet());

      await expect(
        service.create(USER_ID, {
          ...dto,
          startDate: '2026-12-31',
          endDate:   '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // findOne() — CRUD helper
  // ═══════════════════════════════════════════════════════════════════════════

  describe('findOne()', () => {
    it('returns the goal when caller owns the linked wallet', async () => {
      const saving = makeSavings({ wallet: makeWallet({ userId: USER_ID }) as any });
      savingsRepo.findOne.mockResolvedValue(saving);

      const result = await service.findOne(SAVING_ID, USER_ID);

      expect(result).toEqual(saving);
    });

    it('throws 404 when no goal matches', async () => {
      savingsRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(SAVING_ID, USER_ID))
        .rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller does not own the linked wallet', async () => {
      const saving = makeSavings({
        wallet: makeWallet({ userId: 'someone-else' }) as any,
      });
      savingsRepo.findOne.mockResolvedValue(saving);

      await expect(service.findOne(SAVING_ID, USER_ID))
        .rejects.toThrow(ForbiddenException);
    });
  });
});
