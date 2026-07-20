import { AccountDeletionController } from './account-deletion.controller';

describe('AccountDeletionController', () => {
  const deletionService = {
    requestDeletion: jest.fn(),
    confirmDeletion: jest.fn(),
  };
  const controller = new AccountDeletionController(deletionService as any);

  beforeEach(() => jest.clearAllMocks());

  it('always returns the generic request response', async () => {
    deletionService.requestDeletion.mockResolvedValue(undefined);

    await expect(
      controller.requestDeletion({ email: 'person@example.com' }),
    ).resolves.toEqual({
      message:
        'If an account exists for this email, a confirmation link has been sent.',
    });
  });

  it('confirms deletion only after the service validates the token', async () => {
    deletionService.confirmDeletion.mockResolvedValue(undefined);

    await expect(
      controller.confirmDeletion({ token: 'a'.repeat(64) }),
    ).resolves.toEqual({ message: 'Account deleted successfully.' });
    expect(deletionService.confirmDeletion).toHaveBeenCalledWith(
      'a'.repeat(64),
    );
  });
});
