import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from './user.entity';
import { AccountDeletionRequest } from './account-deletion-request.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from './users.service';

const DEFAULT_TOKEN_TTL_MINUTES = 60;

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);
  private readonly tokenTtlMinutes: number;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(AccountDeletionRequest)
    private readonly requestsRepo: Repository<AccountDeletionRequest>,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    config: ConfigService,
  ) {
    const configuredTtl = Number(
      config.get<string>('ACCOUNT_DELETION_TOKEN_TTL_MINUTES'),
    );
    this.tokenTtlMinutes =
      Number.isInteger(configuredTtl) && configuredTtl > 0
        ? configuredTtl
        : DEFAULT_TOKEN_TTL_MINUTES;
  }

  async requestDeletion(emailInput: string): Promise<void> {
    const email = emailInput.trim().toLowerCase();
    const now = new Date();
    await this.requestsRepo.delete({ expiresAt: LessThan(now) });

    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) return;

    await this.requestsRepo.delete({ userId: user.id });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const request = this.requestsRepo.create({
      userId: user.id,
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(
        now.getTime() + this.tokenTtlMinutes * 60 * 1000,
      ),
    });
    const saved = await this.requestsRepo.save(request);

    try {
      await this.mailService.sendAccountDeletionLink(user.email, rawToken);
    } catch {
      await this.requestsRepo.delete({ id: saved.id });
      this.logger.error(
        `Failed to send account deletion email for userId=${user.id}`,
      );
    }
  }

  async confirmDeletion(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const request = await this.requestsRepo.findOne({
      where: { tokenHash, expiresAt: MoreThan(new Date()) },
    });

    if (!request) {
      throw new BadRequestException('Invalid or expired deletion link');
    }

    const claimed = await this.requestsRepo.delete({
      id: request.id,
      tokenHash,
    });
    if (claimed.affected !== 1) {
      throw new BadRequestException('Invalid or expired deletion link');
    }

    await this.usersService.deleteCurrentUser(request.userId);
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
