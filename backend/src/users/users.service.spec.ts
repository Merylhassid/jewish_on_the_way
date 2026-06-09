import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock };

  const makeUser = (): User =>
    ({
      id: 1,
      email: 'user@example.com',
      passwordHash: 'stored_hash',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      role: 'user',
      profileImageUrl: null,
      kashrutLevel: null,
      resetPasswordToken: 'some-token',
      resetPasswordExpires: new Date(),
      createdAt: new Date(),
      deletedAt: undefined,
    } as User);

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // --- getCurrentUser ---

  describe('getCurrentUser', () => {
    it('returns the user profile without any sensitive fields', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser());

      const result = await service.getCurrentUser(1);

      expect(result.email).toBe('user@example.com');
      expect(result.firstName).toBe('Test');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('resetPasswordToken');
      expect(result).not.toHaveProperty('resetPasswordExpires');
      expect(result).not.toHaveProperty('isActive');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.getCurrentUser(99)).rejects.toThrow(NotFoundException);
    });
  });

  // --- changePassword ---

  describe('changePassword', () => {
    it('hashes the new password and saves it when the current password is correct', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash');
      usersRepo.save.mockResolvedValue(makeUser());

      const result = await service.changePassword(1, {
        currentPassword: 'correct_password',
        newPassword: 'new_password',
      });

      expect(result).toEqual({ message: 'Password updated successfully' });
      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'new_hash' }),
      );
    });

    it('throws BadRequestException when the current password is wrong', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(1, { currentPassword: 'wrong', newPassword: 'new' }),
      ).rejects.toThrow(BadRequestException);

      expect(usersRepo.save).not.toHaveBeenCalled();
    });
  });

  // --- deleteCurrentUser ---

  describe('deleteCurrentUser', () => {
    it('soft-deletes by setting isActive=false and returns a confirmation', async () => {
      usersRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.deleteCurrentUser(1);

      expect(usersRepo.update).toHaveBeenCalledWith({ id: 1 }, { isActive: false });
      expect(result).toEqual({ message: 'Account deleted successfully' });
    });

    it('throws NotFoundException when no matching user was found to delete', async () => {
      usersRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.deleteCurrentUser(99)).rejects.toThrow(NotFoundException);
    });
  });
});
