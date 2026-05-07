import { Injectable, Logger } from '@nestjs/common';

export type AuditAction =
  | 'USER_REGISTERED'
  | 'USER_LOGIN'
  | 'USER_LOGIN_FAILED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_DONE'
  | 'MINYAN_CREATED'
  | 'MINYAN_REGISTERED'
  | 'MINYAN_UNREGISTERED'
  | 'HOSTING_OFFER_CREATED'
  | 'HOSTING_OFFER_DEACTIVATED'
  | 'HOSTING_REQUEST_SENT'
  | 'HOSTING_REQUEST_APPROVED'
  | 'HOSTING_REQUEST_REJECTED'
  | 'CHAT_MESSAGE_SENT'
  | 'RESTAURANT_CREATED'
  | 'RESTAURANT_DELETED'
  | 'DESTINATION_CREATED'
  | 'DESTINATION_DELETED'
  | 'USER_BLOCKED';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AUDIT');

  log(
    action: AuditAction,
    userId: number | null,
    meta: Record<string, unknown> = {},
  ) {
    this.logger.log(
      JSON.stringify({
        action,
        userId,
        ts: new Date().toISOString(),
        ...meta,
      }),
    );
  }
}
