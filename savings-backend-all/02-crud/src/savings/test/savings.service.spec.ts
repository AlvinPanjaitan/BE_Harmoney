import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavingsService } from '../savings.service';
import { SavingsGoal, SavingsStatus } from '../entities/savings-goal.entity';
import { CreateSavingsDto } from '../dto/create-savings.dto';
import { UpdateSavingsDto } from '../dto/update-savings.dto';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const OWNER_ID = 'user-owner-uuid';
const OTHER_ID = 'user-other-uuid';
const GOAL_ID  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const makeGoal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal =>
  ({
    id: GOAL_ID,
    userId: OWNER_ID,
    name: 'Car Fund',
    targetAmount: 5000,
    currentSaved: 0,
    deadline: null,
    note: null,
    status: SavingsStatus.ACTIVE,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-05-01'),
    ...overrides,
  } as SavingsGoal);

// QueryBuilder mock used by findAll
const buildQb = (results: SavingsGoal[] = []) => ({
  where:      jest.fn().mockReturnThis(),
  andWhere:   jest.fn().mockReturnThis(),
  orderBy:    jest.fn().mockReturnThis(),
  getMany:    jest.fn().mockResolvedValue(results),
});

const mockRepo = () => {
  const qb = buildQb();
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne:            jest.fn(),
    create:             jest.fn(),
    save:               jest.fn(),
    remove:             jest.fn(),
    _qb: qb,
  };
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SavingsService', () => {
  let service: SavingsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    repo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsService,
        { provide: getRepositoryToken(SavingsGoal), useValue: repo },
      ],
    }).compile();

    service = module.get<SavingsService>(SavingsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('always filters by userId', async () => {
      repo._qb.getMany.mockResolvedValue([makeGoal()]);

      await service.findAll(OWNER_ID, {});

      expect(repo._qb.where).toHaveBeenCalledWith(
        'goal.userId = :userId',
        { userId: OWNER_ID },
      );
    });

    it('does not add a status filter when status is "all"', async () => {
      await service.findAll(OWNER_ID, { status: 'all' });

      expect(repo._qb.andWhere).not.toHaveBeenCalled();
    });

    it('does not add a status filter when status is omitted', async () => {
      await service.findAll(OWNER_ID, {});

      expect(repo._qb.andWhere).not.toHaveBeenCalled();
    });

    it('adds a status filter for "active"', async () => {
      await service.findAll(OWNER_ID, { status: SavingsStatus.ACTIVE });

      expect(repo._qb.andWhere).toHaveBeenCalledWith(
        'goal.status = :status',
        { status: SavingsStatus.ACTIVE },
      );
    });

    it('adds a status filter for "completed"', async () => {
      await service.findAll(OWNER_ID, { status: SavingsStatus.COMPLETED });

      expect(repo._qb.andWhere).toHaveBeenCalledWith(
        'goal.status = :status',
        { status: SavingsStatus.COMPLETED },
      );
    });

    it('sorts by deadline ASC NULLS LAST when sort=deadline', async () => {
      await service.findAll(OWNER_ID, { sort: 'deadline' });

      expect(repo._qb.orderBy).toHaveBeenCalledWith(
        'goal.deadline', 'ASC', 'NULLS LAST',
      );
    });

    it('defaults to createdAt DESC when no sort is given', async () => {
      await service.findAll(OWNER_ID, {});

      expect(repo._qb.orderBy).toHaveBeenCalledWith('goal.createdAt', 'DESC');
    });

    it('returns the rows produced by the query builder', async () => {
      const rows = [makeGoal(), makeGoal({ id: 'other' })];
      repo._qb.getMany.mockResolvedValue(rows);

      const result = await service.findAll(OWNER_ID, {});

      expect(result).toEqual(rows);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns the goal when caller is the owner', async () => {
      const stub = makeGoal();
      repo.findOne.mockResolvedValue(stub);

      const result = await service.findOne(GOAL_ID, OWNER_ID);

      expect(result).toEqual(stub);
    });

    it('throws 404 when no row matches', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(GOAL_ID, OWNER_ID))
        .rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not the owner', async () => {
      repo.findOne.mockResolvedValue(makeGoal({ userId: 'some-other-user' }));

      await expect(service.findOne(GOAL_ID, OTHER_ID))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws 403 — not 404 — for cross-tenant access (clearer debugging)', async () => {
      repo.findOne.mockResolvedValue(makeGoal({ userId: 'someone-else' }));

      const error = await service.findOne(GOAL_ID, OWNER_ID).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error).not.toBeInstanceOf(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto: CreateSavingsDto = {
      name: 'Car Fund',
      targetAmount: 5000,
      deadline: '2026-12-31',
      note: 'New car',
    };

    it('creates a goal with currentSaved=0 and status=active', async () => {
      const built = makeGoal({ currentSaved: 0, status: SavingsStatus.ACTIVE });
      repo.create.mockReturnValue(built);
      repo.save.mockResolvedValue(built);

      const result = await service.create(OWNER_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: OWNER_ID,
          currentSaved: 0,
          status: SavingsStatus.ACTIVE,
        }),
      );
      expect(result).toEqual(built);
    });

    it('always uses the userId from the JWT, not from the dto', async () => {
      // attempt to inject userId via dto — should be ignored
      const malicious = { ...dto, userId: 'attacker' } as any;
      repo.create.mockReturnValue(makeGoal());
      repo.save.mockResolvedValue(makeGoal());

      await service.create(OWNER_ID, malicious);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: OWNER_ID }),
      );
    });

    it('parses the deadline string into a Date', async () => {
      let capturedDeadline: Date | null | undefined;
      repo.create.mockImplementation((data) => {
        capturedDeadline = data.deadline;
        return data;
      });
      repo.save.mockResolvedValue(makeGoal());

      await service.create(OWNER_ID, dto);

      expect(capturedDeadline).toBeInstanceOf(Date);
      expect(capturedDeadline?.toISOString().slice(0, 10)).toBe('2026-12-31');
    });

    it('stores null deadline when omitted', async () => {
      let captured: Date | null | undefined;
      repo.create.mockImplementation((data) => {
        captured = data.deadline;
        return data;
      });
      repo.save.mockResolvedValue(makeGoal());

      await service.create(OWNER_ID, { name: 'X', targetAmount: 100 });

      expect(captured).toBeNull();
    });

    it('wraps unexpected DB errors as 500', async () => {
      repo.create.mockReturnValue(makeGoal());
      repo.save.mockRejectedValue(new Error('DB exploded'));

      await expect(service.create(OWNER_ID, dto))
        .rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates only the provided fields', async () => {
      const stub = makeGoal({ name: 'Original', targetAmount: 1000 });
      repo.findOne.mockResolvedValue(stub);
      repo.save.mockImplementation((g) => Promise.resolve(g));

      const dto: UpdateSavingsDto = { name: 'Renamed' };
      const result = await service.update(GOAL_ID, OWNER_ID, dto);

      expect(result.name).toBe('Renamed');
      expect(result.targetAmount).toBe(1000); // untouched
    });

    it('can transition status to completed', async () => {
      const stub = makeGoal({ status: SavingsStatus.ACTIVE });
      repo.findOne.mockResolvedValue(stub);
      repo.save.mockImplementation((g) => Promise.resolve(g));

      const result = await service.update(GOAL_ID, OWNER_ID, {
        status: SavingsStatus.COMPLETED,
      });

      expect(result.status).toBe(SavingsStatus.COMPLETED);
    });

    it('throws 404 when goal does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(GOAL_ID, OWNER_ID, { name: 'X' }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not the owner', async () => {
      repo.findOne.mockResolvedValue(makeGoal({ userId: 'someone-else' }));

      await expect(service.update(GOAL_ID, OWNER_ID, { name: 'X' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('does NOT update currentSaved even if it appears in the entity', async () => {
      const stub = makeGoal({ currentSaved: 1500 });
      repo.findOne.mockResolvedValue(stub);
      repo.save.mockImplementation((g) => Promise.resolve(g));

      // currentSaved is not on UpdateSavingsDto, but verify the service
      // never assigns it from arbitrary input.
      const dto: any = { currentSaved: 999999 };
      const result = await service.update(GOAL_ID, OWNER_ID, dto);

      expect(result.currentSaved).toBe(1500);
    });

    it('parses deadline string into Date when present', async () => {
      const stub = makeGoal();
      repo.findOne.mockResolvedValue(stub);
      repo.save.mockImplementation((g) => Promise.resolve(g));

      const result = await service.update(GOAL_ID, OWNER_ID, {
        deadline: '2027-06-30',
      });

      expect(result.deadline).toBeInstanceOf(Date);
    });

    it('wraps unexpected DB errors as 500', async () => {
      repo.findOne.mockResolvedValue(makeGoal());
      repo.save.mockRejectedValue(new Error('DB exploded'));

      await expect(service.update(GOAL_ID, OWNER_ID, { name: 'X' }))
        .rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('returns success message when owner deletes', async () => {
      const stub = makeGoal();
      repo.findOne.mockResolvedValue(stub);
      repo.remove.mockResolvedValue(stub);

      const result = await service.delete(GOAL_ID, OWNER_ID);

      expect(result).toEqual({ message: 'Savings goal deleted successfully' });
      expect(repo.remove).toHaveBeenCalledWith(stub);
    });

    it('throws 404 when goal does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.delete(GOAL_ID, OWNER_ID))
        .rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not the owner', async () => {
      repo.findOne.mockResolvedValue(makeGoal({ userId: 'someone-else' }));

      await expect(service.delete(GOAL_ID, OWNER_ID))
        .rejects.toThrow(ForbiddenException);
    });

    it('does not call remove() when ownership check fails', async () => {
      repo.findOne.mockResolvedValue(makeGoal({ userId: 'someone-else' }));

      await expect(service.delete(GOAL_ID, OWNER_ID)).rejects.toThrow();

      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('wraps unexpected DB errors as 500', async () => {
      repo.findOne.mockResolvedValue(makeGoal());
      repo.remove.mockRejectedValue(new Error('DB exploded'));

      await expect(service.delete(GOAL_ID, OWNER_ID))
        .rejects.toThrow(InternalServerErrorException);
    });
  });
});
