import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactMessage } from './contact-message.entity';
import { ContactController } from './contact.controller';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage, User]), MailModule],
  controllers: [ContactController],
  providers: [AdminGuard],
})
export class ContactModule {}
