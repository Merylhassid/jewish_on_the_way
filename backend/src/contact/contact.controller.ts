import { Body, Controller, Get, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { MailService } from '../mail/mail.service';
import { ContactMessage } from './contact-message.entity';
import { User } from '../users/user.entity';

class ContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  message: string;
}

@Controller('contact')
export class ContactController {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly repo: Repository<ContactMessage>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly mail: MailService,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  async send(@Body() dto: ContactDto, @Request() req: any) {
    const userId = req.user.sub;
    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });

    const record = this.repo.create({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      subject: dto.subject,
      message: dto.message,
      user: { id: userId },
    });
    await this.repo.save(record);

    await this.mail.sendContactMessage(user.firstName, user.lastName, user.email, dto.subject, dto.message);

    return { ok: true };
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async list() {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }
}
