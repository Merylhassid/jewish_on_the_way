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

  async sendPasswordReset(toEmail: string, resetToken: string): Promise<void> {
    const appUrl = this.config.get<string>('APP_URL')?.replace(/\/$/, '');
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
}
