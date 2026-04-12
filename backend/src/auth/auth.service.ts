import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';

import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private mailService: MailService,
    private audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();

    const exists = await this.usersRepo.findOne({ where: { email } });
    if (exists) throw new BadRequestException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const saved = await this.usersRepo.save(user);
    this.audit.log('USER_REGISTERED', saved.id, { email: saved.email });

    return {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();

    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) {
      this.audit.log('USER_LOGIN_FAILED', null, { email });
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      this.audit.log('USER_LOGIN_FAILED', user.id, { email });
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const access_token = await this.jwtService.signAsync(payload);
    this.audit.log('USER_LOGIN', user.id, { email: user.email });

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase();
    const user = await this.usersRepo.findOne({ where: { email } });

    // Always return success to avoid leaking whether email exists
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = rawToken;
    user.resetPasswordExpires = expires;
    await this.usersRepo.save(user);
    this.audit.log('PASSWORD_RESET_REQUESTED', user.id, { email });

    // In dev, always print the token so you can test without SMTP configured
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(`\n========================================`);
      this.logger.warn(`  PASSWORD RESET TOKEN (dev only)`);
      this.logger.warn(`  Email : ${email}`);
      this.logger.warn(`  Token : ${rawToken}`);
      this.logger.warn(`  Paste this token in the app's Reset Password screen`);
      this.logger.warn(`========================================\n`);
    }

    try {
      await this.mailService.sendPasswordReset(email, rawToken);
    } catch (err) {
      this.logger.error(`Failed to send reset email to ${email}: ${err}`);
      this.logger.warn(`Email not sent — use the token printed above to reset manually.`);
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.usersRepo.findOne({
      where: { resetPasswordToken: dto.token },
    });

    if (!user || !user.resetPasswordExpires) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.usersRepo.save(user);
    this.audit.log('PASSWORD_RESET_DONE', user.id, {});
  }
}
