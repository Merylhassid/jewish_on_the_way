import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MinyansService } from './minyans.service';
import { Minyan } from '../minyan.entity';
import { MinyanRegistration } from '../minyan-registration.entity';
import { Destination } from '../destination.entity';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';

describe('MinyansService', () => {
  let service: MinyansService;

  let minyansRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    increment: jest.Mock;
    decrement: jest.Mock;
    remove: jest.Mock;
    query: jest.Mock;
  };
  let registrationsRepo: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
    delete: jest.Mock;
  };
  let destinationsRepo: { findOne: jest.Mock };
  let usersRepo: { findOneOrFail: jest.Mock };
  let audit: { log: jest.Mock };

  const FUTURE_DATE = '2099-12-31';
  const PAST_DATE = '2000-01-01';

  const makeMinyan = (overrides: Partial<Minyan> = {}): Minyan =>
    ({
      id: 1,
      prayerType: 'shacharit',
      date: FUTURE_DATE,
      time: '08:00',
      locationText: 'Main Hall',
      notes: null,
      participantsCount: 1,
      lat: null,
      lng: null,
      createdAt: new Date(),
      creator: { id: 10, firstName: 'Creator', lastName: 'User' } as User,
      destination: { id: 5, city: 'Tel Aviv' } as Destination,
      registrations: [],
      ...overrides,
    } as Minyan);

  const makeUser = (id = 20): User =>
    ({
      id,
      email: `user${id}@example.com`,
      passwordHash: 'hash',
      firstName: 'First',
      lastName: 'Last',
      isActive: true,
      role: 'user',
    } as User);

  const makeQb = (result: any) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    minyansRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      increment: jest.fn().mockResolvedValue(undefined),
      decrement: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };
    registrationsRepo = {
      createQueryBuilder: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockReturnValue({}),
      remove: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    destinationsRepo = { findOne: jest.fn() };
    usersRepo = { findOneOrFail: jest.fn() };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinyansService,
        { provide: getRepositoryToken(Minyan), useValue: minyansRepo },
        { provide: getRepositoryToken(MinyanRegistration), useValue: registrationsRepo },
        { provide: getRepositoryToken(Destination), useValue: destinationsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<MinyansService>(MinyansService);
  });

  // --- register ---

  describe('register', () => {
    it('saves the registration, increments participantsCount, and returns registered state', async () => {
      const minyan = makeMinyan({ participantsCount: 3 });
      minyansRepo.findOne.mockResolvedValue(minyan);
      registrationsRepo.createQueryBuilder.mockReturnValue(makeQb(null));
      usersRepo.findOneOrFail.mockResolvedValue(makeUser(20));

      const result = await service.register(1, 20);

      expect(registrationsRepo.save).toHaveBeenCalled();
      expect(minyansRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'participantsCount', 1);
      expect(result).toEqual({ registered: true, participantsCount: 4 });
      expect(audit.log).toHaveBeenCalledWith('MINYAN_REGISTERED', 20, expect.any(Object));
    });

    it('throws NotFoundException when the minyan does not exist', async () => {
      minyansRepo.findOne.mockResolvedValue(null);

      await expect(service.register(999, 20)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the minyan date is in the past', async () => {
      minyansRepo.findOne.mockResolvedValue(makeMinyan({ date: PAST_DATE }));

      await expect(service.register(1, 20)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when the user is already registered', async () => {
      minyansRepo.findOne.mockResolvedValue(makeMinyan());
      registrationsRepo.createQueryBuilder.mockReturnValue(makeQb({ id: 5 }));

      await expect(service.register(1, 20)).rejects.toThrow(ConflictException);
    });
  });

  // --- unregister ---

  describe('unregister', () => {
    it('throws ForbiddenException when the creator tries to cancel their own registration', async () => {
      minyansRepo.findOne.mockResolvedValue(makeMinyan({ creator: { id: 10 } as User }));

      await expect(service.unregister(1, 10)).rejects.toThrow(ForbiddenException);
    });

    it('removes the registration and decrements participantsCount for a regular user', async () => {
      const minyan = makeMinyan({ creator: { id: 10 } as User, participantsCount: 5 });
      const reg = { id: 7 };
      minyansRepo.findOne.mockResolvedValue(minyan);
      registrationsRepo.createQueryBuilder.mockReturnValue(makeQb(reg));

      const result = await service.unregister(1, 20);

      expect(registrationsRepo.remove).toHaveBeenCalledWith(reg);
      expect(minyansRepo.decrement).toHaveBeenCalledWith({ id: 1 }, 'participantsCount', 1);
      expect(result).toEqual({ registered: false, participantsCount: 4 });
    });
  });

  // --- create ---

  describe('create', () => {
    it('throws BadRequestException when the date is in the past', async () => {
      const dto = {
        destinationId: 5,
        prayerType: 'shacharit',
        date: PAST_DATE,
        time: '08:00',
        locationText: 'Main Hall',
      };

      await expect(service.create(dto as any, 10)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the destination does not exist', async () => {
      const dto = {
        destinationId: 999,
        prayerType: 'shacharit',
        date: FUTURE_DATE,
        time: '08:00',
        locationText: 'Main Hall',
      };
      destinationsRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto as any, 10)).rejects.toThrow(NotFoundException);
    });

    it('saves the minyan, auto-registers the creator, and returns the formatted result', async () => {
      const dto = {
        destinationId: 5,
        prayerType: 'shacharit',
        date: FUTURE_DATE,
        time: '08:00',
        locationText: 'Main Hall',
        notes: 'Test note',
        lat: 32.08,
        lng: 34.78,
      };
      const creator = makeUser(10);
      const destination = { id: 5, city: 'Tel Aviv' } as Destination;
      const savedMinyan = makeMinyan({ id: 99, creator, destination, participantsCount: 1 });

      destinationsRepo.findOne.mockResolvedValue(destination);
      usersRepo.findOneOrFail.mockResolvedValue(creator);
      minyansRepo.create.mockReturnValue(savedMinyan);
      minyansRepo.save.mockResolvedValue(savedMinyan);

      const result = await service.create(dto as any, 10);

      expect(minyansRepo.save).toHaveBeenCalled();
      expect(registrationsRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(99);
      expect(audit.log).toHaveBeenCalledWith('MINYAN_CREATED', 10, expect.any(Object));
    });
  });

  // --- deleteMinyan ---

  describe('deleteMinyan', () => {
    it('throws NotFoundException when the minyan does not exist', async () => {
      minyansRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteMinyan(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a non-creator tries to delete', async () => {
      minyansRepo.findOne.mockResolvedValue(makeMinyan({ creator: { id: 10 } as User }));

      await expect(service.deleteMinyan(1, 99)).rejects.toThrow(ForbiddenException);
    });

    it('deletes all registrations and the minyan when called by the creator', async () => {
      const minyan = makeMinyan({ creator: { id: 10 } as User });
      minyansRepo.findOne.mockResolvedValue(minyan);

      const result = await service.deleteMinyan(1, 10);

      expect(registrationsRepo.delete).toHaveBeenCalledWith({ minyan: { id: 1 } });
      expect(minyansRepo.remove).toHaveBeenCalledWith(minyan);
      expect(result).toEqual({ deleted: true });
      expect(audit.log).toHaveBeenCalledWith('MINYAN_DELETED', 10, expect.any(Object));
    });
  });

  // --- almostFull / isFull thresholds (via findOne) ---

  describe('capacity thresholds', () => {
    it('marks almostFull=true when participantsCount is 8', async () => {
      minyansRepo.findOne.mockResolvedValue(makeMinyan({ participantsCount: 8 }));
      registrationsRepo.createQueryBuilder.mockReturnValue(makeQb(null));

      const result = await service.findOne(1, 20);

      expect(result.almostFull).toBe(true);
      expect(result.isFull).toBe(false);
    });

    it('marks isFull=true when participantsCount reaches 10', async () => {
      minyansRepo.findOne.mockResolvedValue(makeMinyan({ participantsCount: 10 }));
      registrationsRepo.createQueryBuilder.mockReturnValue(makeQb(null));

      const result = await service.findOne(1, 20);

      expect(result.almostFull).toBe(false);
      expect(result.isFull).toBe(true);
    });

    it('marks almostFull=false and isFull=false when participantsCount is below threshold', async () => {
      minyansRepo.findOne.mockResolvedValue(makeMinyan({ participantsCount: 3 }));
      registrationsRepo.createQueryBuilder.mockReturnValue(makeQb(null));

      const result = await service.findOne(1, 20);

      expect(result.almostFull).toBe(false);
      expect(result.isFull).toBe(false);
    });
  });
});
