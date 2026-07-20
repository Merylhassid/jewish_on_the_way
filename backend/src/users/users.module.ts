import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserBlock } from './user-block.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { HostingRequest } from '../hosting/entities/hosting-request.entity';
import { AccountDeletionRequest } from './account-deletion-request.entity';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionController } from './account-deletion.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserBlock,
      HostingRequest,
      AccountDeletionRequest,
    ]),
    CloudinaryModule,
    MailModule,
  ],
  providers: [UsersService, AccountDeletionService],
  controllers: [UsersController, AccountDeletionController],
  exports: [UsersService],
})
export class UsersModule {}
