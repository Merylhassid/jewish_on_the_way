import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  private toSafeUser(user: User) {
    const {
      passwordHash,
      resetPasswordToken,
      resetPasswordExpires,
      role,
      isActive,
      deletedAt,
      ...safeUser
    } = user;
    return safeUser;
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
    const result = await this.usersRepository.update(
      { id: userId },
      { isActive: false },
    );

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    return { message: 'Account deleted successfully' };
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
