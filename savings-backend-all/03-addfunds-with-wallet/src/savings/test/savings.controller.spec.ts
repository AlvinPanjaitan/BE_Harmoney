import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SavingsController } from '../savings.controller';
import { SavingsService } from '../savings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Savings } from '../entities/savings.entity';
import { CreateSavingsDto } from '../dto/create-savings.dto';
import { AddFundsDto } from '../dto/add-funds.dto';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const USER: JwtPayload = { sub: 'user-owner-uuid', email: 'alice@example.com' };
const SAVING_ID = 1;

const savingStub = {
  savingId: SAVING_ID,
  walletId: 10,
  name: 'Vacation Fund',
  targetAmount: 1000,
  currentAmount: 250,
  startDate: new Date('2026-01-01'),
  endDate:   new Date('2026-12-31'),
  wallet: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Savings;

const mockService = () => ({
  create:             jest.fn(),
  findOne:            jest.fn(),
  addFunds:           jest.fn(),
  calculateProgress:  jest.fn(),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SavingsController', () => {
  let controller: SavingsController;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingsController],
      providers: [{ provide: SavingsService, useFactory: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SavingsController>(SavingsController);
    service    = module.get(SavingsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto: CreateSavingsDto = {
      walletId: 10,
      name: 'Vacation Fund',
      targetAmount: 1000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };

    it('returns the created goal', async () => {
      service.create.mockResolvedValue(savingStub);

      const result = await controller.create(USER, dto);

      expect(service.create).toHaveBeenCalledWith(USER.sub, dto);
      expect(result).toEqual(savingStub);
    });

    it('passes user.sub (UUID), not user.email, to the service', async () => {
      service.create.mockResolvedValue(savingStub);

      await controller.create(USER, dto);

      const [passedUserId] = service.create.mock.calls[0];
      expect(passedUserId).toBe(USER.sub);
      expect(passedUserId).not.toBe(USER.email);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns the goal when service succeeds', async () => {
      service.findOne.mockResolvedValue(savingStub);

      const result = await controller.findOne(SAVING_ID, USER);

      expect(service.findOne).toHaveBeenCalledWith(SAVING_ID, USER.sub);
      expect(result).toEqual(savingStub);
    });

    it('propagates 404 from service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(SAVING_ID, USER))
        .rejects.toThrow(NotFoundException);
    });

    it('propagates 403 from service', async () => {
      service.findOne.mockRejectedValue(new ForbiddenException());

      await expect(controller.findOne(SAVING_ID, USER))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── addFunds ──────────────────────────────────────────────────────────────

  describe('addFunds()', () => {
    const dto: AddFundsDto = { amount: 100, fromWalletId: 11 };

    it('returns the success-message envelope', async () => {
      service.addFunds.mockResolvedValue(undefined);

      const result = await controller.addFunds(SAVING_ID, USER, dto);

      expect(result).toEqual({ message: 'Funds added successfully' });
    });

    it('delegates with (savingId, amount, fromWalletId, userId)', async () => {
      service.addFunds.mockResolvedValue(undefined);

      await controller.addFunds(SAVING_ID, USER, dto);

      expect(service.addFunds).toHaveBeenCalledWith(
        SAVING_ID,
        dto.amount,
        dto.fromWalletId,
        USER.sub,
      );
    });

    it('propagates 400 (insufficient funds) from service', async () => {
      service.addFunds.mockRejectedValue(
        new BadRequestException('Insufficient balance.'),
      );

      await expect(controller.addFunds(SAVING_ID, USER, dto))
        .rejects.toThrow(BadRequestException);
    });

    it('propagates 403 from service', async () => {
      service.addFunds.mockRejectedValue(new ForbiddenException());

      await expect(controller.addFunds(SAVING_ID, USER, dto))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates 404 from service', async () => {
      service.addFunds.mockRejectedValue(new NotFoundException());

      await expect(controller.addFunds(SAVING_ID, USER, dto))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── progress ──────────────────────────────────────────────────────────────

  describe('progress()', () => {
    it('returns the full progress envelope with all fields', async () => {
      service.findOne.mockResolvedValue(savingStub);
      service.calculateProgress.mockResolvedValue(0.25);

      const result = await controller.progress(SAVING_ID, USER);

      expect(result).toEqual({
        savingId: SAVING_ID,
        currentAmount: 250,
        targetAmount: 1000,
        progress: 0.25,
      });
    });

    it('enforces ownership BEFORE computing progress', async () => {
      service.findOne.mockRejectedValue(new ForbiddenException());

      await expect(controller.progress(SAVING_ID, USER))
        .rejects.toThrow(ForbiddenException);

      // calculateProgress should never be called if ownership check fails
      expect(service.calculateProgress).not.toHaveBeenCalled();
    });

    it('propagates 404 from findOne', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.progress(SAVING_ID, USER))
        .rejects.toThrow(NotFoundException);

      expect(service.calculateProgress).not.toHaveBeenCalled();
    });
  });
});
