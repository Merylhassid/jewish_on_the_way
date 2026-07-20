import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export type AuditAction =
  | 'USER_REGISTERED'
  | 'USER_LOGIN'
  | 'USER_LOGIN_FAILED'
  | 'USER_LOGOUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_DONE'
  | 'EMAIL_VERIFIED'
  | 'MINYAN_CREATED'
  | 'MINYAN_REGISTERED'
  | 'MINYAN_UNREGISTERED'
  | 'MINYAN_UPDATED'
  | 'MINYAN_DELETED'
  | 'HOSTING_OFFER_CREATED'
  | 'HOSTING_OFFER_UPDATED'
  | 'HOSTING_OFFER_DEACTIVATED'
  | 'HOSTING_REQUEST_SENT'
  | 'HOSTING_REQUEST_APPROVED'
  | 'HOSTING_REQUEST_REJECTED'
  | 'HOSTING_REQUEST_CANCELLED'
  | 'HOSTING_NEED_CREATED'
  | 'HOSTING_NEED_RESPONDED'
  | 'CHAT_MESSAGE_SENT'
  | 'CHAT_MESSAGE_REPORTED'
  | 'RESTAURANT_CREATED'
  | 'RESTAURANT_DELETED'
  | 'DESTINATION_CREATED'
  | 'DESTINATION_DELETED'
  | 'USER_BLOCKED';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AUDIT');
  private readonly fingerprintSecret: string;

  constructor(config: ConfigService) {
    const dedicatedSecret = config
      .get<string>('AUDIT_FINGERPRINT_SECRET')
      ?.trim();
    const jwtFallback = config.get<string>('JWT_SECRET')?.trim();
    const secret = dedicatedSecret || jwtFallback;

    if (!secret) {
      throw new Error(
        'AUDIT_FINGERPRINT_SECRET or JWT_SECRET must be configured',
      );
    }

    this.fingerprintSecret = secret;
    if (!dedicatedSecret) {
      this.logger.warn(
        'AUDIT_FINGERPRINT_SECRET is not set; using the JWT_SECRET fallback',
      );
    }
  }

  fingerprintEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    return createHmac('sha256', this.fingerprintSecret)
      .update(`audit-email-fingerprint:v1:${normalizedEmail}`)
      .digest('hex');
  }

  log(
    action: AuditAction,
    userId: number | null,
    meta: Record<string, unknown> = {},
  ) {
    const safeMeta = Object.fromEntries(
      Object.entries(meta).filter(([key]) => key.toLowerCase() !== 'email'),
    );

    this.logger.log(
      JSON.stringify({
        action,
        userId,
        ts: new Date().toISOString(),
        ...safeMeta,
      }),
    );
  }
}
