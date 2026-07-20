import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

describe('MailService privacy-safe logging', () => {
  let service: MailService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue(undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          MAIL_HOST: 'smtp.example.com',
          MAIL_PORT: 587,
          MAIL_SECURE: 'false',
          MAIL_USER: 'service@example.com',
          MAIL_PASS: 'secret',
          APP_URL: 'https://api.example.com',
          PUBLIC_WEB_URL: 'https://jewishontheway.com',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    service = new MailService(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not log the recipient of a verification email', async () => {
    await service.sendVerificationCode('person@example.com', '123456');

    expect(logSpy).toHaveBeenCalledWith('Verification email sent');
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('person@example.com');
  });

  it('does not log the sender of a contact message', async () => {
    await service.sendContactMessage(
      'Test',
      'Person',
      'person@example.com',
      'Question',
      'Hello',
    );

    expect(logSpy).toHaveBeenCalledWith('Contact message saved and forwarded');
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('person@example.com');
  });

  it('does not log the recipient of a password reset email', async () => {
    await service.sendPasswordReset('person@example.com', 'raw-reset-token');

    expect(logSpy).toHaveBeenCalledWith('Password reset email sent');
    const logs = JSON.stringify(logSpy.mock.calls);
    expect(logs).not.toContain('person@example.com');
    expect(logs).not.toContain('raw-reset-token');
  });

  it('sends an account-deletion review link without logging its email or token', async () => {
    await service.sendAccountDeletionLink(
      'person@example.com',
      'a'.repeat(64),
    );

    const message = mockSendMail.mock.calls[0][0];
    expect(message.html).toContain(
      `https://jewishontheway.com/delete-account?token=${'a'.repeat(64)}`,
    );
    expect(message.html).toContain('Opening it does not delete the account');
    expect(logSpy).toHaveBeenCalledWith('Account deletion email sent');
    const logs = JSON.stringify(logSpy.mock.calls);
    expect(logs).not.toContain('person@example.com');
    expect(logs).not.toContain('a'.repeat(64));
  });
});
