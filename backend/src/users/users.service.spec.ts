import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserBlock } from './user-block.entity';
import { HostingRequest } from '../hosting/entities/hosting-request.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock };
  let blocksRepo: Record<string, jest.Mock>;
  let hostingRequestsRepo: Record<string, jest.Mock>;
  let manager: { findOne: jest.Mock; query: jest.Mock; delete: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let cloudinaryService: { deleteImageByUrl: jest.Mock };

  const makeUser = (overrides: Partial<User> = {}): User =>
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
      ...overrides,
    } as User);

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    blocksRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };
    hostingRequestsRepo = {
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
    };
    manager = {
      findOne: jest.fn(),
      query: jest.fn(),
      delete: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation((callback: any) => callback(manager)),
    };
    cloudinaryService = { deleteImageByUrl: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(UserBlock), useValue: blocksRepo },
        { provide: getRepositoryToken(HostingRequest), useValue: hostingRequestsRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: CloudinaryService, useValue: cloudinaryService },
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
    it('hard-deletes the account and explicitly removes rows without user foreign keys', async () => {
      manager.findOne.mockResolvedValue(
        makeUser({
          profileImageUrl:
            'https://res.cloudinary.com/demo/image/upload/v1/avatars/avatar-1.jpg',
        }),
      );
      manager.query.mockImplementation(async (sql: string) =>
        sql.includes('SELECT image_url')
          ? [
              {
                image_url:
                  'https://res.cloudinary.com/demo/image/upload/v1/community-posts/post-1.jpg',
              },
            ]
          : [],
      );
      manager.delete.mockResolvedValue({ affected: 1 });
      cloudinaryService.deleteImageByUrl.mockResolvedValue(true);

      const result = await service.deleteCurrentUser(1);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM hosting_requests'),
        [1],
      );
      for (const table of [
        'chat_cursors',
        'user_favorites',
        'place_reviews',
        'place_reports',
        'place_requests',
      ]) {
        expect(manager.query).toHaveBeenCalledWith(
          `DELETE FROM ${table} WHERE user_id = $1`,
          [1],
        );
      }
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM contact_messages'),
        [1, 'user@example.com'],
      );
      expect(manager.delete).toHaveBeenCalledWith(User, { id: 1 });
      expect(cloudinaryService.deleteImageByUrl).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ message: 'Account deleted successfully' });
    });

    it('throws NotFoundException when no matching user was found to delete', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.deleteCurrentUser(99)).rejects.toThrow(NotFoundException);
      expect(manager.delete).not.toHaveBeenCalled();
      expect(cloudinaryService.deleteImageByUrl).not.toHaveBeenCalled();
    });
  });
});
