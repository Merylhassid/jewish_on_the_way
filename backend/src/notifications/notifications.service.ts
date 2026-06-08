import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPush(
    token: string | null | undefined,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!token?.startsWith('ExponentPushToken[')) return;

    try {
      const resp = await fetch('https://exp.host/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: token, title, body, sound: 'default', data }),
      });
      if (!resp.ok) this.logger.warn(`Push delivery failed: ${resp.status}`);
    } catch (err) {
      this.logger.warn(`Push error: ${String(err)}`);
    }
  }
}
