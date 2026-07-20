import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './user.entity';
import { UserBlock } from './user-block.entity';
import { HostingRequest } from '../hosting/entities/hosting-request.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserBlock)
    private blocksRepository: Repository<UserBlock>,
    @InjectRepository(HostingRequest)
    private hostingRequestsRepository: Repository<HostingRequest>,
    private dataSource: DataSource,
    private cloudinaryService: CloudinaryService,
  ) {}

  private toSafeUser(user: User) {
    const {
      passwordHash,
      resetPasswordToken,
      resetPasswordExpires,
      isActive,
      deletedAt,
      googleId,
      appleId,
      facebookId,
      ...safeUser
    } = user;
    return { ...safeUser, hasPassword: Boolean(passwordHash) };
  }

  async getCurrentUser(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(user);
  }

  async updateCurrentUser(userId: number, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, updateUserDto);

    const updatedUser = await this.usersRepository.save(user);

    return this.toSafeUser(updatedUser);
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('This account does not have a password');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);

    return { message: 'Password updated successfully' };
  }

  async deleteCurrentUser(userId: number) {
    const mediaUrls = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      const imageRows: Array<{ image_url: string | null }> = await manager.query(
        `SELECT image_url FROM chat_messages WHERE user_id = $1 AND image_url IS NOT NULL`,
        [userId],
      );

      // Requests can reference the host either directly (host_id) or through
      // an offer. host_id is not a foreign key in the live schema, so both
      // paths must be removed explicitly before the user's offers disappear.
      await manager.query(
        `DELETE FROM hosting_requests
         WHERE user_id = $1
            OR host_id = $1
            OR offer_id IN (SELECT id FROM hosting_offers WHERE user_id = $1)`,
        [userId],
      );

      // These live tables contain user IDs but do not currently have a
      // foreign key to users, so a hard delete would otherwise leave orphans.
      for (const table of [
        'chat_cursors',
        'user_favorites',
        'place_reviews',
        'place_reports',
        'place_requests',
      ]) {
        await manager.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      }

      // Contact messages may contain personal data in both their structured
      // fields and free text. Delete them before the user FK becomes NULL.
      await manager.query(
        `DELETE FROM contact_messages
         WHERE user_id = $1 OR LOWER(email) = LOWER($2)`,
        [userId, user.email],
      );

      const result = await manager.delete(User, { id: userId });
      if (result.affected === 0) throw new NotFoundException('User not found');

      return Array.from(
        new Set(
          [user.profileImageUrl, ...imageRows.map((row) => row.image_url)].filter(
            (url): url is string => Boolean(url),
          ),
        ),
      );
    });

    // External network calls cannot participate in the database transaction.
    // The account is already deleted; media cleanup is retried and logged.
    await Promise.all(mediaUrls.map((url) => this.deleteMediaWithRetry(url)));

    return { message: 'Account deleted successfully' };
  }

  private async deleteMediaWithRetry(imageUrl: string) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.cloudinaryService.deleteImageByUrl(imageUrl);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 100));
        }
      }
    }

    this.logger.error(
      `Failed to delete user media from Cloudinary after 3 attempts: ${imageUrl}`,
      lastError instanceof Error ? lastError.stack : undefined,
    );
  }

  async updateAvatar(userId: number, imageUrl: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.profileImageUrl = imageUrl;

    const updatedUser = await this.usersRepository.save(user);

    return this.toSafeUser(updatedUser);
  }
  async savePushToken(userId: number, token: string) {
    await this.usersRepository.update({ id: userId }, { pushToken: token });
    return { ok: true };
  }

  // ── Blocking ───────────────────────────────────────────────────────────────

  async blockUser(blockerId: number, blockedId: number) {
    if (blockerId === blockedId) throw new BadRequestException('Cannot block yourself');
    const blocked = await this.usersRepository.findOne({ where: { id: blockedId } });
    if (!blocked) throw new NotFoundException('User not found');

    const existing = await this.blocksRepository.findOne({ where: { blockerId, blockedId } });
    if (!existing) {
      await this.blocksRepository.save(this.blocksRepository.create({ blockerId, blockedId }));
    }

    // A block ends any live arrangement between the two — cancel it, don't leave it dangling
    const liveRequests = await this.hostingRequestsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'guest')
      .leftJoinAndSelect('r.offer', 'o')
      .leftJoinAndSelect('o.user', 'offerUser')
      .where('r.status IN (:...statuses)', { statuses: ['pending', 'approved'] })
      .getMany();

    const affected = liveRequests.filter((r) => {
      const guestId = r.user?.id;
      const hostId = r.offer?.user?.id ?? r.host_id ?? undefined;
      const pair = [guestId, hostId];
      return pair.includes(blockerId) && pair.includes(blockedId);
    });
    for (const r of affected) {
      r.status = 'cancelled';
      await this.hostingRequestsRepository.save(r);
    }

    return { success: true };
  }

  async unblockUser(blockerId: number, blockedId: number) {
    await this.blocksRepository.delete({ blockerId, blockedId });
    return { success: true };
  }

  async listBlocked(blockerId: number) {
    const rows = await this.blocksRepository.find({
      where: { blockerId },
      relations: ['blocked'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.blocked.id,
      firstName: r.blocked.firstName,
      lastName: r.blocked.lastName,
      blockedAt: r.createdAt,
    }));
  }

  // Bidirectional — either side having blocked the other hides content both ways
  async isBlockedEitherWay(userId1: number, userId2: number) {
    const count = await this.blocksRepository.count({
      where: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    });
    return count > 0;
  }

  // All user IDs on either side of a block involving this user (for query filters)
  async getBlockedUserIds(userId: number): Promise<number[]> {
    const rows = await this.blocksRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });
    const ids = new Set<number>();
    for (const r of rows) {
      ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
    }
    return [...ids];
  }

  async removeAvatar(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.profileImageUrl = null;

    const updatedUser = await this.usersRepository.save(user);

    return this.toSafeUser(updatedUser);
  }
}
