import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('MAIL_HOST'),
      port: this.config.get<number>('MAIL_PORT'),
      secure: this.config.get<string>('MAIL_SECURE') === 'true',
      auth: {
        user: this.config.get<string>('MAIL_USER'),
        pass: this.config.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendContactMessage(
    firstName: string,
    lastName: string,
    fromEmail: string,
    subject: string,
    message: string,
  ): Promise<void> {
    const toEmail = this.config.get<string>('MAIL_USER')!;
    await this.transporter.sendMail({
      from: `"Jewish On The Way" <${toEmail}>`,
      to: toEmail,
      replyTo: `"${firstName} ${lastName}" <${fromEmail}>`,
      subject: `[Contact] ${subject}`,
      html: `
        <div style="margin:0;padding:0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
          <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
              <h2 style="margin:0 0 20px;font-size:20px;color:#0b1736;">New message from the app</h2>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:80px;">Name</td><td style="padding:6px 0;font-size:14px;font-weight:600;">${firstName} ${lastName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Email</td><td style="padding:6px 0;font-size:14px;"><a href="mailto:${fromEmail}" style="color:#2d6cdf;">${fromEmail}</a></td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Subject</td><td style="padding:6px 0;font-size:14px;font-weight:600;">${subject}</td></tr>
              </table>
              <div style="background:#f6f8fc;border-radius:12px;padding:16px;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message}</div>
              <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Reply directly to this email to respond to the user.</p>
            </div>
          </div>
        </div>
      `,
    });
    this.logger.log(`Contact message from ${fromEmail} saved and forwarded`);
  }

  async sendPasswordReset(toEmail: string, resetToken: string): Promise<void> {
    const appUrl = this.config.get<string>('APP_URL')?.replace(/\/$/, '');
    if (!appUrl) {
      throw new Error('APP_URL is not configured');
    }

    const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    await this.transporter.sendMail({
      from: `"Jewish On The Way" <${this.config.get<string>('MAIL_USER')}>`,
      to: toEmail,
      subject: 'Reset your password – Jewish On The Way',
      html: `
        <div style="margin:0;padding:0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
          <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hello,</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">You requested a password reset for your Jewish On The Way account.</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Use the button below to set a new password.</p>

              <div style="text-align:center;margin:28px 0;">
                <a href="${resetLink}" style="display:inline-block;background:#2d6cdf;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:5px;font-weight:700;font-size:16px;">Reset Password</a>
              </div>
              <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">This link expires in <strong>1 hour</strong>.</p>
              <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">If you did not request this, you can ignore this email.</p>
            </div>
          </div>
        </div>
      `,
    });

    this.logger.log(`Password reset email sent to ${toEmail}`);
  }

  async sendReportNotification(opts: {
    reporterName: string;
    reporterEmail: string;
    entityType: string;
    entityId: number;
    reportType: string;
    description?: string | null;
    placeName?: string | null;
    placeAddress?: string | null;
    placePhone?: string | null;
    placeCity?: string | null;
  }): Promise<void> {
    const to = this.config.get<string>('MAIL_USER')!;
    const label = opts.entityType === 'restaurant' ? 'Restaurant' : 'Synagogue';
    const displayName = opts.placeName ?? `${label} #${opts.entityId}`;
    await this.transporter.sendMail({
      from: `"Jewish On The Way" <${to}>`,
      to,
      subject: `[Report] ${displayName} — ${opts.reportType}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#0b1736;margin:0 0 16px;">New ${label} Report</h2>

          <div style="background:#f0f4ff;border-radius:12px;padding:14px 16px;margin-bottom:16px;border-left:4px solid #0b1736;">
            <div style="font-size:16px;font-weight:700;color:#0b1736;margin-bottom:4px;">${displayName}</div>
            ${opts.placeCity    ? `<div style="font-size:13px;color:#6b7280;">📍 ${opts.placeCity}${opts.placeAddress ? ` · ${opts.placeAddress}` : ''}</div>` : ''}
            ${opts.placePhone   ? `<div style="font-size:13px;color:#6b7280;">📞 ${opts.placePhone}</div>` : ''}
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr><td style="color:#6b7280;font-size:13px;padding:5px 0;width:110px;">Reported by</td><td style="font-size:14px;">${opts.reporterName} &lt;${opts.reporterEmail}&gt;</td></tr>
            <tr><td style="color:#6b7280;font-size:13px;padding:5px 0;">Report type</td><td style="font-size:14px;font-weight:600;color:#dc2626;">${opts.reportType}</td></tr>
          </table>

          ${opts.description ? `<div style="background:#fff7ed;border-radius:10px;padding:14px;font-size:14px;line-height:1.6;border-left:3px solid #f97316;">${opts.description}</div>` : ''}
        </div>`,
    });
  }

  async sendRequestNotification(opts: {
    requesterName: string;
    requesterEmail: string;
    entityType: string;
    name: string;
    city?: string;
    address?: string | null;
    phone?: string | null;
    notes?: string | null;
  }): Promise<void> {
    const to = this.config.get<string>('MAIL_USER')!;
    const label = opts.entityType === 'restaurant' ? 'Restaurant' : 'Synagogue';
    await this.transporter.sendMail({
      from: `"Jewish On The Way" <${to}>`,
      to,
      subject: `[Suggestion] New ${label} — ${opts.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#0b1736;margin:0 0 16px;">New ${label} Suggestion</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr><td style="color:#6b7280;font-size:13px;padding:5px 0;width:110px;">Suggested by</td><td style="font-size:14px;">${opts.requesterName} &lt;${opts.requesterEmail}&gt;</td></tr>
            <tr><td style="color:#6b7280;font-size:13px;padding:5px 0;">Name</td><td style="font-size:14px;font-weight:600;">${opts.name}</td></tr>
            ${opts.city ? `<tr><td style="color:#6b7280;font-size:13px;padding:5px 0;">City</td><td style="font-size:14px;">${opts.city}</td></tr>` : ''}
            ${opts.address ? `<tr><td style="color:#6b7280;font-size:13px;padding:5px 0;">Address</td><td style="font-size:14px;">${opts.address}</td></tr>` : ''}
            ${opts.phone ? `<tr><td style="color:#6b7280;font-size:13px;padding:5px 0;">Phone</td><td style="font-size:14px;">${opts.phone}</td></tr>` : ''}
          </table>
          ${opts.notes ? `<div style="background:#f6f8fc;border-radius:10px;padding:14px;font-size:14px;line-height:1.6;">${opts.notes}</div>` : ''}
        </div>`,
    });
  }
}
