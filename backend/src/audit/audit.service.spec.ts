import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const makeService = (values: Record<string, string | undefined>) =>
    new AuditService({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService);

  it('creates a stable, case-insensitive email fingerprint', () => {
    const service = makeService({
      AUDIT_FINGERPRINT_SECRET: 'dedicated-audit-secret',
      JWT_SECRET: 'jwt-secret',
    });

    expect(service.fingerprintEmail(' User@Example.com ')).toBe(
      service.fingerprintEmail('user@example.com'),
    );
  });

  it('uses the dedicated audit secret instead of the JWT secret', () => {
    const first = makeService({
      AUDIT_FINGERPRINT_SECRET: 'audit-secret-one',
      JWT_SECRET: 'same-jwt-secret',
    });
    const second = makeService({
      AUDIT_FINGERPRINT_SECRET: 'audit-secret-two',
      JWT_SECRET: 'same-jwt-secret',
    });

    expect(first.fingerprintEmail('user@example.com')).not.toBe(
      second.fingerprintEmail('user@example.com'),
    );
  });

  it('falls back to JWT_SECRET when the dedicated secret is absent', () => {
    const first = makeService({ JWT_SECRET: 'fallback-secret' });
    const second = makeService({ JWT_SECRET: 'fallback-secret' });

    expect(first.fingerprintEmail('user@example.com')).toBe(
      second.fingerprintEmail('user@example.com'),
    );
  });

  it('removes a raw email field from audit metadata', () => {
    const service = makeService({
      AUDIT_FINGERPRINT_SECRET: 'dedicated-audit-secret',
    });
    const logger = (service as any).logger;
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);

    service.log('USER_LOGIN_FAILED', null, {
      email: 'user@example.com',
      emailFingerprint: 'safe-fingerprint',
    });

    const output = logger.log.mock.calls[0][0] as string;
    expect(output).not.toContain('user@example.com');
    expect(output).toContain('safe-fingerprint');
  });
});
