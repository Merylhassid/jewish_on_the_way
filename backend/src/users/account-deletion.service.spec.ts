import { BadRequestException, Logger } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;
  let usersRepo: { findOne: jest.Mock };
  let requestsRepo: {
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let mailService: { sendAccountDeletionLink: jest.Mock };
  let usersService: { deleteCurrentUser: jest.Mock };

  beforeEach(() => {
    usersRepo = { findOne: jest.fn() };
    requestsRepo = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 9, ...value })),
      findOne: jest.fn(),
    };
    mailService = { sendAccountDeletionLink: jest.fn() };
    usersService = { deleteCurrentUser: jest.fn() };
    const config = { get: jest.fn().mockReturnValue('60') };

    service = new AccountDeletionService(
      usersRepo as any,
      requestsRepo as any,
      mailService as any,
      usersService as any,
      config as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns silently and sends no email when the account does not exist', async () => {
    usersRepo.findOne.mockResolvedValue(null);

    await expect(
      service.requestDeletion('missing@example.com'),
    ).resolves.toBeUndefined();

    expect(mailService.sendAccountDeletionLink).not.toHaveBeenCalled();
    expect(requestsRepo.save).not.toHaveBeenCalled();
  });

  it('normalizes the email and stores only a hash of a one-hour token', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 7,
      email: 'person@example.com',
    });
    mailService.sendAccountDeletionLink.mockResolvedValue(undefined);
    const before = Date.now();

    await service.requestDeletion('  PERSON@Example.com ');

    expect(usersRepo.findOne).toHaveBeenCalledWith({
      where: { email: 'person@example.com' },
    });
    const created = requestsRepo.create.mock.calls[0][0];
    const rawToken = mailService.sendAccountDeletionLink.mock.calls[0][1];
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.tokenHash).not.toBe(rawToken);
    expect(created.userId).toBe(7);
    expect(created.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 60 * 60 * 1000,
    );
    expect(mailService.sendAccountDeletionLink).toHaveBeenCalledWith(
      'person@example.com',
      rawToken,
    );
  });

  it('invalidates the token without exposing the email when delivery fails', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 7,
      email: 'person@example.com',
    });
    mailService.sendAccountDeletionLink.mockRejectedValue(
      new Error('SMTP rejected person@example.com'),
    );
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();

    await expect(
      service.requestDeletion('person@example.com'),
    ).resolves.toBeUndefined();

    expect(requestsRepo.delete).toHaveBeenCalledWith({ id: 9 });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send account deletion email for userId=7',
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
      'person@example.com',
    );
  });

  it('claims a valid token once and uses the existing full deletion flow', async () => {
    requestsRepo.findOne.mockResolvedValue({ id: 9, userId: 7 });
    requestsRepo.delete.mockResolvedValue({ affected: 1 });
    usersService.deleteCurrentUser.mockResolvedValue({
      message: 'Account deleted successfully',
    });

    await service.confirmDeletion('a'.repeat(64));

    expect(requestsRepo.delete).toHaveBeenCalledWith({
      id: 9,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(usersService.deleteCurrentUser).toHaveBeenCalledWith(7);
  });

  it('rejects an invalid or expired token without deleting an account', async () => {
    requestsRepo.findOne.mockResolvedValue(null);

    await expect(service.confirmDeletion('b'.repeat(64))).rejects.toThrow(
      BadRequestException,
    );
    expect(usersService.deleteCurrentUser).not.toHaveBeenCalled();
  });

  it('rejects a token already claimed by another request', async () => {
    requestsRepo.findOne.mockResolvedValue({ id: 9, userId: 7 });
    requestsRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(service.confirmDeletion('c'.repeat(64))).rejects.toThrow(
      BadRequestException,
    );
    expect(usersService.deleteCurrentUser).not.toHaveBeenCalled();
  });
});
