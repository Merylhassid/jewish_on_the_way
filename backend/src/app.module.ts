import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { ChatModule } from './chat/chat.module';
import { MinyansModule } from './minyans/minyans.module';
import { HostingModule } from './hosting/hosting.module';
import { AuditModule } from './audit/audit.module';
import { AiModule } from './ai/ai.module';
import { SynagoguesModule } from './synagogues/synagogues.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';

import { UsersModule } from './users/users.module';
import { DestinationsModule } from './destinations/destinations.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { AdminModule } from './admin/admin.module';
import { PlacesModule } from './places/places.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // req 11.1 — in-memory cache for hot endpoints (destinations, restaurants)
    CacheModule.register({ isGlobal: true, ttl: 30_000, max: 200 }),

    // req 9.3 — global rate limiting: 100 req / 60 s per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const rejectUnauthorized = config.get<string>(
          'DB_SSL_REJECT_UNAUTHORIZED',
        );

        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST'),
          port: Number(config.get<string>('DB_PORT')),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASS'),
          database: config.get<string>('DB_NAME'),
          ssl:
            config.get<string>('DB_SSL') === 'true'
              ? {
                  rejectUnauthorized:
                    rejectUnauthorized === undefined
                      ? false
                      : rejectUnauthorized === 'true',
                }
              : false,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: config.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),

    HealthModule,

    AuthModule,

    UsersModule,

    DestinationsModule,

    RestaurantsModule,

    SynagoguesModule,

    AdminModule,

    PlacesModule,

    CloudinaryModule,

    ChatModule,

    MinyansModule,

    HostingModule,

    AuditModule,

    AiModule,

    ReviewsModule,
    FavoritesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply ThrottlerGuard globally (req 9.3)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
