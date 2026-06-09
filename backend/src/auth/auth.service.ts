import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private mailService: MailService,
    private audit: AuditService,
  ) {}

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();

    try {
      const code = this.generateVerificationCode();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      const saved = await this.dataSource.transaction(async (manager) => {
        const exists = await manager.findOne(User, { where: { email } });
        if (exists && exists.isActive)
          throw new BadRequestException('Email already exists');
        if (exists)
          await manager.delete(User, { id: exists.id });

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = manager.create(User, {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isActive: false,
          emailVerificationCode: codeHash,
          emailVerificationExpires: expires,
        });
        return manager.save(user);
      });

      await this.mailService.sendVerificationCode(email, code);
      this.audit.log('USER_REGISTERED', saved.id, { email: saved.email });
      return {
        id: saved.id,
        email: saved.email,
        firstName: saved.firstName,
        lastName: saved.lastName,
        requiresVerification: true,
      };
    } catch (err: any) {
      if (err?.code === '23505') throw new ConflictException('Email already exists');
      throw err;
    }
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });

    if (!user || !user.emailVerificationCode || !user.emailVerificationExpires) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    if (user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== user.emailVerificationCode) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    user.isActive = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;
    await this.usersRepo.save(user);
    this.audit.log('EMAIL_VERIFIED', user.id, { email: user.email });

    const payload = { sub: user.id, email: user.email };
    const access_token = await this.jwtService.signAsync(payload);
    return {
      access_token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    };
  }

  async resendVerification(email: string) {
    const user = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user || user.isActive) return;

    const code = this.generateVerificationCode();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    user.emailVerificationCode = codeHash;
    user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);
    await this.usersRepo.save(user);
    await this.mailService.sendVerificationCode(user.email, code);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();

    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user || !user.isActive) {
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

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    user.refreshToken = refreshTokenHash;
    user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.usersRepo.save(user);

    this.audit.log('USER_LOGIN', user.id, { email: user.email });

    return {
      access_token,
      refresh_token: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const user = await this.usersRepo.findOne({ where: { refreshToken: tokenHash } });

    if (
      !user ||
      !user.isActive ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const payload = { sub: user.id, email: user.email };
    const access_token = await this.jwtService.signAsync(payload);

    return { access_token };
  }

  async logout(userId: number): Promise<void> {
    await this.usersRepo.update(userId, {
      refreshToken: null,
      refreshTokenExpiresAt: null,
    });
    this.audit.log('USER_LOGOUT', userId, {});
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase();
    const user = await this.usersRepo.findOne({ where: { email } });

    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = expires;
    await this.usersRepo.save(user);
    this.audit.log('PASSWORD_RESET_REQUESTED', user.id, { email });

    if (process.env.NODE_ENV === 'development') {
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
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await this.usersRepo.save(user);

      if (process.env.NODE_ENV === 'development') {
        this.logger.warn(
          'Email not sent; reset token was invalidated. Check SMTP/APP_URL configuration.',
        );
      }

      throw new InternalServerErrorException(
        'Unable to send password reset email. Please try again later.',
      );
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const user = await this.usersRepo.findOne({
      where: { resetPasswordToken: tokenHash },
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
