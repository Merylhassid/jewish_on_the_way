import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let usersRepo: { findOne: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    usersRepo = { findOne: jest.fn() };
    const config = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    strategy = new JwtStrategy(config, usersRepo as unknown as Repository<User>);
  });

  it('rejects an access token after its user account no longer exists', async () => {
    usersRepo.findOne.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 42, email: 'deleted@example.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts an active existing user', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 42, isActive: true, deletedAt: null });

    await expect(
      strategy.validate({ sub: 42, email: 'active@example.com' }),
    ).resolves.toEqual({ sub: 42, email: 'active@example.com' });
  });
});
