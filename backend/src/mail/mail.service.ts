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
    const deepLink = `jewishontheway://reset-password?token=${resetToken}`;

    await this.transporter.sendMail({
      from: `"Jewish On The Way" <${this.config.get<string>('MAIL_USER')}>`,
      to: toEmail,
      subject: 'Reset your password – Jewish On The Way',
      html: `
        <p>Hello,</p>
        <p>You requested a password reset.</p>

        <p><strong>Option 1 – Open the app directly:</strong><br/>
        <a href="${deepLink}">Tap here to open the app and reset your password</a></p>

        <p><strong>Option 2 – Copy this token into the app:</strong><br/>
        Open <em>Jewish On The Way → Forgot Password → Reset Password</em> and paste the token below:</p>
        <p style="background:#f0f4ff;padding:12px;border-radius:8px;font-family:monospace;font-size:16px;word-break:break-all;">
          ${resetToken}
        </p>

        <p>This token expires in <strong>1 hour</strong>.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });

    this.logger.log(`Password reset email sent to ${toEmail}`);
  }
}
