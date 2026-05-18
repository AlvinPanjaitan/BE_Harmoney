import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SavingsController } from '../savings.controller';
import { SavingsService } from '../savings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SavingsGoal, SavingsStatus } from '../entities/savings-goal.entity';
import { CreateSavingsDto } from '../dto/create-savings.dto';
import { UpdateSavingsDto } from '../dto/update-savings.dto';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const GOAL_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const mockUser: JwtPayload = {
  sub: 'user-owner-uuid',
  email: 'alice@example.com',
};

const goalStub: SavingsGoal = {
  id: GOAL_ID,
  userId: mockUser.sub,
  name: 'Car Fund',
  targetAmount: 5000,
  currentSaved: 0,
  deadline: new Date('2026-12-31'),
  note: null,
  status: SavingsStatus.ACTIVE,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-05-01'),
};

const mockService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
  delete:  jest.fn(),
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

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('forwards the JWT userId and query filters to the service', async () => {
      service.findAll.mockResolvedValue([goalStub]);

      const query = { status: SavingsStatus.ACTIVE, sort: 'deadline' as const };
      const result = await controller.findAll(mockUser, query);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.sub, query);
      expect(result).toEqual([goalStub]);
    });

    it('returns an empty array when the user has no goals', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockUser, {});

      expect(result).toEqual([]);
    });

    it('passes an empty query object when no filters are provided', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll(mockUser, {});

      expect(service.findAll).toHaveBeenCalledWith(mockUser.sub, {});
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns the goal when service succeeds', async () => {
      service.findOne.mockResolvedValue(goalStub);

      const result = await controller.findOne(GOAL_ID, mockUser);

      expect(service.findOne).toHaveBeenCalledWith(GOAL_ID, mockUser.sub);
      expect(result).toEqual(goalStub);
    });

    it('propagates 404 from service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(GOAL_ID, mockUser))
        .rejects.toThrow(NotFoundException);
    });

    it('propagates 403 from service', async () => {
      service.findOne.mockRejectedValue(new ForbiddenException());

      await expect(controller.findOne(GOAL_ID, mockUser))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto: CreateSavingsDto = {
      name: 'Car Fund',
      targetAmount: 5000,
      deadline: '2026-12-31',
    };

    it('returns the created goal', async () => {
      service.create.mockResolvedValue(goalStub);

      const result = await controller.create(mockUser, dto);

      expect(service.create).toHaveBeenCalledWith(mockUser.sub, dto);
      expect(result).toEqual(goalStub);
    });

    it('passes user.sub (UUID), not email, to the service', async () => {
      service.create.mockResolvedValue(goalStub);

      await controller.create(mockUser, dto);

      const [passedUserId] = service.create.mock.calls[0];
      expect(passedUserId).toBe(mockUser.sub);
      expect(passedUserId).not.toBe(mockUser.email);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    const dto: UpdateSavingsDto = { status: SavingsStatus.COMPLETED };

    it('returns the updated goal', async () => {
      const updated = { ...goalStub, status: SavingsStatus.COMPLETED };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(GOAL_ID, mockUser, dto);

      expect(service.update).toHaveBeenCalledWith(GOAL_ID, mockUser.sub, dto);
      expect(result.status).toBe(SavingsStatus.COMPLETED);
    });

    it('propagates 404 from service', async () => {
      service.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(GOAL_ID, mockUser, dto))
        .rejects.toThrow(NotFoundException);
    });

    it('propagates 403 from service', async () => {
      service.update.mockRejectedValue(new ForbiddenException());

      await expect(controller.update(GOAL_ID, mockUser, dto))
        .rejects.toThrow(ForbiddenException);
    });

    it('accepts an empty body (all fields optional)', async () => {
      service.update.mockResolvedValue(goalStub);

      const result = await controller.update(GOAL_ID, mockUser, {});

      expect(result).toEqual(goalStub);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('returns success message on owner deletion', async () => {
      service.delete.mockResolvedValue({
        message: 'Savings goal deleted successfully',
      });

      const result = await controller.delete(GOAL_ID, mockUser);

      expect(service.delete).toHaveBeenCalledWith(GOAL_ID, mockUser.sub);
      expect(result.message).toBe('Savings goal deleted successfully');
    });

    it('propagates 404 from service', async () => {
      service.delete.mockRejectedValue(new NotFoundException());

      await expect(controller.delete(GOAL_ID, mockUser))
        .rejects.toThrow(NotFoundException);
    });

    it('propagates 403 from service', async () => {
      service.delete.mockRejectedValue(new ForbiddenException());

      await expect(controller.delete(GOAL_ID, mockUser))
        .rejects.toThrow(ForbiddenException);
    });
  });
});
