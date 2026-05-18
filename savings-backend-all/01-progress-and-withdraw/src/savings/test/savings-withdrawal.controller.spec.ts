import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SavingsController } from '../savings.controller';
import { SavingsService } from '../savings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WithdrawDto } from '../dto/withdraw.dto';
import { WithdrawResponseDto } from '../dto/withdraw-response.dto';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const GOAL_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const WDL_ID  = 'f7e6d5c4-b3a2-4190-8fed-cba987654321';

const mockUser: JwtPayload = {
  sub:   'user-owner-uuid',
  email: 'alice@example.com',
};

const withdrawalStub: WithdrawResponseDto = {
  id:           WDL_ID,
  savingsId:    GOAL_ID,
  type:         'WITHDRAWAL',
  amount:       200,
  date:         '2026-05-16T12:00:00.000Z',
  note:         'Emergency repair',
  newTotalSaved: 800,
};

const mockSavingsService = () => ({
  addProgress: jest.fn(),
  withdraw:    jest.fn(),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SavingsController — withdraw()', () => {
  let controller: SavingsController;
  let savingsService: ReturnType<typeof mockSavingsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingsController],
      providers: [{ provide: SavingsService, useFactory: mockSavingsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller    = module.get<SavingsController>(SavingsController);
    savingsService = module.get(SavingsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Happy paths ───────────────────────────────────────────────────────────

  describe('success', () => {
    const dto: WithdrawDto = { amount: 200, note: 'Emergency repair' };

    it('returns the WithdrawResponseDto including type: WITHDRAWAL', async () => {
      savingsService.withdraw.mockResolvedValue(withdrawalStub);

      const result = await controller.withdraw(GOAL_ID, mockUser, dto);

      expect(result).toEqual(withdrawalStub);
      expect(result.type).toBe('WITHDRAWAL');
    });

    it('delegates to savingsService.withdraw with (goalId, userId, dto)', async () => {
      savingsService.withdraw.mockResolvedValue(withdrawalStub);

      await controller.withdraw(GOAL_ID, mockUser, dto);

      expect(savingsService.withdraw).toHaveBeenCalledWith(
        GOAL_ID,
        mockUser.sub,
        dto,
      );
      expect(savingsService.withdraw).toHaveBeenCalledTimes(1);
    });

    it('passes user.sub (UUID), not email, to the service', async () => {
      savingsService.withdraw.mockResolvedValue(withdrawalStub);

      await controller.withdraw(GOAL_ID, mockUser, dto);

      const [, passedUserId] = savingsService.withdraw.mock.calls[0];
      expect(passedUserId).toBe('user-owner-uuid');
      expect(passedUserId).not.toBe('alice@example.com');
    });

    it('works with minimal dto (amount only)', async () => {
      savingsService.withdraw.mockResolvedValue({
        ...withdrawalStub,
        note: null,
      });
      const minimalDto: WithdrawDto = { amount: 100 };

      const result = await controller.withdraw(GOAL_ID, mockUser, minimalDto);

      expect(result.note).toBeNull();
    });

    it('does not call addProgress when withdraw is called', async () => {
      savingsService.withdraw.mockResolvedValue(withdrawalStub);
      await controller.withdraw(GOAL_ID, mockUser, dto);

      expect(savingsService.addProgress).not.toHaveBeenCalled();
    });
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  describe('error propagation', () => {
    const dto: WithdrawDto = { amount: 100 };

    it('propagates 400 BadRequest (insufficient funds) from service', async () => {
      savingsService.withdraw.mockRejectedValue(
        new BadRequestException(
          'Insufficient funds: cannot withdraw 100 from a balance of 50.',
        ),
      );

      await expect(
        controller.withdraw(GOAL_ID, mockUser, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates 403 Forbidden from service', async () => {
      savingsService.withdraw.mockRejectedValue(
        new ForbiddenException('You do not have permission.'),
      );

      await expect(
        controller.withdraw(GOAL_ID, mockUser, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates 404 NotFound from service', async () => {
      savingsService.withdraw.mockRejectedValue(
        new NotFoundException("Savings goal 'x' not found."),
      );

      await expect(
        controller.withdraw(GOAL_ID, mockUser, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
