import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Minyan } from '../minyan.entity';
import { MinyanRegistration } from '../minyan-registration.entity';
import { Destination } from '../destination.entity';
import { User } from '../users/user.entity';
import { MinyansController } from './minyans.controller';
import { MinyansService } from './minyans.service';
import { MinyanGateway } from './minyan.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Minyan, MinyanRegistration, Destination, User]),
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [MinyansController],
  providers: [MinyansService, MinyanGateway],
})
export class MinyansModule {}
