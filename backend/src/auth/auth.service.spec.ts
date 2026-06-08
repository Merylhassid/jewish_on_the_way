import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let mailService: { sendPasswordReset: jest.Mock };
  let audit: { log: jest.Mock };

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 1,
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      role: 'user',
      profileImageUrl: null,
      kashrutLevel: null,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      createdAt: new Date(),
      ...overrides,
    } as User);

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    // Mock manager strips the Entity-class first arg so repo mock assertions keep working
    const mockManager = {
      findOne: (_Entity: any, opts: any) => usersRepo.findOne(opts),
      save:    (entity: any)             => usersRepo.save(entity),
      create:  (_Entity: any, data: any) => usersRepo.create(data),
      delete:  (_Entity: any, opts: any) => usersRepo.delete(opts),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation((cb: any) => cb(mockManager)),
    };
    jwtService = { signAsync: jest.fn() };
    mailService = { sendPasswordReset: jest.fn() };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: DataSource,               useValue: dataSource },
        { provide: JwtService,               useValue: jwtService },
        { provide: MailService,              useValue: mailService },
        { provide: AuditService,             useValue: audit },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // --- register ---

  describe('register', () => {
    it('creates a new user and returns only public fields (no passwordHash)', async () => {
      const dto = { email: 'NEW@Example.com', password: 'pass123', firstName: 'New', lastName: 'User' };
      const saved = makeUser({ id: 5, email: 'new@example.com', firstName: 'New', lastName: 'User' });

      usersRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      usersRepo.create.mockReturnValue(saved);
      usersRepo.save.mockResolvedValue(saved);

      const result = await service.register(dto);

      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
      expect(result).toEqual({ id: 5, email: 'new@example.com', firstName: 'New', lastName: 'User' });
      expect(result).not.toHaveProperty('passwordHash');
      expect(audit.log).toHaveBeenCalledWith('USER_REGISTERED', 5, expect.any(Object));
    });

    it('throws BadRequestException when email already exists and is active', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ isActive: true }));

      await expect(
        service.register({ email: 'test@example.com', password: 'x', firstName: 'A', lastName: 'B' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes the soft-deleted account so the same email can re-register', async () => {
      const deleted = makeUser({ id: 2, isActive: false });
      const fresh = makeUser({ id: 3 });

      usersRepo.findOne.mockResolvedValue(deleted);
      usersRepo.delete.mockResolvedValue({ affected: 1 });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      usersRepo.create.mockReturnValue(fresh);
      usersRepo.save.mockResolvedValue(fresh);

      await service.register({ email: 'test@example.com', password: 'pass', firstName: 'A', lastName: 'B' });

      expect(usersRepo.delete).toHaveBeenCalledWith({ id: 2 });
      expect(usersRepo.save).toHaveBeenCalled();
    });
  });

  // --- login ---

  describe('login', () => {
    it('returns access_token and user on correct credentials', async () => {
      const user = makeUser();
      usersRepo.findOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.login({ email: 'TEST@EXAMPLE.COM', password: 'pass' });

      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result.access_token).toBe('jwt-token');
      expect(result.user).toEqual({ id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User' });
      expect(audit.log).toHaveBeenCalledWith('USER_LOGIN', 1, expect.any(Object));
    });

    it('throws UnauthorizedException when user is not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@example.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user account is inactive', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ isActive: false }));

      await expect(service.login({ email: 'test@example.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException and logs failure when password is wrong', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(audit.log).toHaveBeenCalledWith('USER_LOGIN_FAILED', 1, expect.any(Object));
    });
  });

  // --- forgotPassword ---

  describe('forgotPassword', () => {
    it('returns silently when the email is not registered — no email sent', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.forgotPassword({ email: 'unknown@example.com' })).resolves.toBeUndefined();
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('saves a hashed reset token and sends the raw token by email', async () => {
      const user = makeUser();
      usersRepo.findOne.mockResolvedValue(user);
      usersRepo.save.mockResolvedValue(user);
      mailService.sendPasswordReset.mockResolvedValue(undefined);

      await service.forgotPassword({ email: 'test@example.com' });

      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          resetPasswordToken: expect.any(String),
          resetPasswordExpires: expect.any(Date),
        }),
      );
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith('test@example.com', expect.any(String));
      expect(audit.log).toHaveBeenCalledWith('PASSWORD_RESET_REQUESTED', 1, expect.any(Object));
    });
  });

  // --- resetPassword ---

  describe('resetPassword', () => {
    it('resets the password and clears the token on a valid, unexpired token', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const user = makeUser({ resetPasswordToken: 'some-hash', resetPasswordExpires: future });
      usersRepo.findOne.mockResolvedValue(user);
      usersRepo.save.mockResolvedValue(user);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed');

      await service.resetPassword({ token: 'raw-token', newPassword: 'newpass123' });

      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: 'new_hashed',
          resetPasswordToken: null,
          resetPasswordExpires: null,
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('PASSWORD_RESET_DONE', 1, expect.any(Object));
    });

    it('throws BadRequestException when the reset token is not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.resetPassword({ token: 'invalid', newPassword: 'newpass' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the reset token has expired', async () => {
      const past = new Date(Date.now() - 1000);
      const user = makeUser({ resetPasswordToken: 'some-hash', resetPasswordExpires: past });
      usersRepo.findOne.mockResolvedValue(user);

      await expect(service.resetPassword({ token: 'raw', newPassword: 'newpass' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
