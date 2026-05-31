import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminGuard } from './admin.guard';
import { User } from '../users/user.entity';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let usersRepo: { findOne: jest.Mock };

  const makeContext = (sub: number | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: sub !== undefined ? { sub } : undefined }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(async () => {
    usersRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
  });

  it('throws ForbiddenException when no user is attached to the request', async () => {
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the user is not found in the database', async () => {
    usersRepo.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext(1))).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the user role is not admin', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 1, role: 'user' });

    await expect(guard.canActivate(makeContext(1))).rejects.toThrow(ForbiddenException);
  });

  it('returns true when the user role is admin', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 1, role: 'admin' });

    const result = await guard.canActivate(makeContext(1));

    expect(result).toBe(true);
    expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
