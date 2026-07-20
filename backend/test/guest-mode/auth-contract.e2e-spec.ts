import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { AdminGuard } from '../../src/admin/admin.guard';
import { SearchClassifierService } from '../../src/ai/search-classifier.service';
import { SearchFeedback } from '../../src/ai/search-feedback.entity';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../src/auth/guards/optional-jwt-auth.guard';
import { ChatController } from '../../src/chat/chat.controller';
import { ChatPublicFeedService } from '../../src/chat/chat-public-feed.service';
import { CloudinaryService } from '../../src/cloudinary/cloudinary.service';
import { DestinationsController } from '../../src/destinations/destinations.controller';
import { DestinationsService } from '../../src/destinations/destinations.service';
import { FavoritesController } from '../../src/favorites/favorites.controller';
import { FavoritesService } from '../../src/favorites/favorites.service';
import { HostingController } from '../../src/hosting/hosting.controller';
import { HostingService } from '../../src/hosting/hosting.service';
import { MinyansController } from '../../src/minyans/minyans.controller';
import { MinyansService } from '../../src/minyans/minyans.service';
import { RestaurantsController } from '../../src/restaurants/restaurants.controller';
import { RestaurantsService } from '../../src/restaurants/restaurants.service';
import { ReviewsController } from '../../src/reviews/reviews.controller';
import { ReviewsService } from '../../src/reviews/reviews.service';
import { SynagoguesController } from '../../src/synagogues/synagogues.controller';
import { SynagoguesService } from '../../src/synagogues/synagogues.service';

class ContractJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.headers.authorization !== 'Bearer contract-test-token') {
      throw new UnauthorizedException();
    }
    req.user = { sub: 42, role: 'user' };
    return true;
  }
}

class ContractOptionalJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authorization = req.headers.authorization;
    if (!authorization) return true;
    if (authorization !== 'Bearer contract-test-token') {
      throw new UnauthorizedException();
    }
    req.user = { sub: 42, role: 'user' };
    return true;
  }
}

const destinationsService = {
  findAll: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue({ id: 1, city: 'Test City' }),
  search: jest.fn().mockResolvedValue([]),
};

const restaurantsService = {
  findByDestination: jest.fn().mockResolvedValue([]),
  findByParentDestination: jest.fn().mockResolvedValue([]),
  findNearby: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Test Restaurant' }),
};

const minyansService = {
  findMine: jest.fn().mockResolvedValue([]),
  findNearby: jest.fn().mockResolvedValue([]),
  findUpcoming: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue({ id: 1, isRegistered: false }),
  getParticipants: jest.fn().mockResolvedValue([]),
};

const reviewsService = {
  getReviews: jest.fn().mockResolvedValue({ average: null, count: 0, reviews: [] }),
};

const synagoguesService = {
  findByDestination: jest.fn().mockResolvedValue([]),
  findByParentDestination: jest.fn().mockResolvedValue([]),
  findNearby: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Test Synagogue' }),
};

const hostingService = {
  summary: jest.fn().mockResolvedValue({ activeOffers: 0, openNeeds: 0, pendingMine: 0 }),
};

const favoritesService = {
  getAll: jest.fn().mockResolvedValue({ restaurants: [], synagogues: [] }),
};

const chatPublicFeedService = {
  getFeed: jest.fn().mockResolvedValue([]),
  getPost: jest.fn().mockResolvedValue({ id: 1 }),
};

describe('Guest-mode HTTP auth contract', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [
        DestinationsController,
        RestaurantsController,
        MinyansController,
        ReviewsController,
        SynagoguesController,
        HostingController,
        FavoritesController,
        ChatController,
      ],
      providers: [
        { provide: DestinationsService, useValue: destinationsService },
        { provide: RestaurantsService, useValue: restaurantsService },
        { provide: MinyansService, useValue: minyansService },
        { provide: ReviewsService, useValue: reviewsService },
        { provide: SynagoguesService, useValue: synagoguesService },
        { provide: HostingService, useValue: hostingService },
        { provide: FavoritesService, useValue: favoritesService },
        { provide: ChatPublicFeedService, useValue: chatPublicFeedService },
        { provide: CloudinaryService, useValue: { uploadImage: jest.fn() } },
        {
          provide: SearchClassifierService,
          useValue: { classify: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: getRepositoryToken(SearchFeedback),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() },
        },
      ],
    });

    const moduleFixture: TestingModule = await moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useClass(ContractJwtGuard)
      .overrideGuard(OptionalJwtAuthGuard)
      .useClass(ContractOptionalJwtGuard)
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('public reads', () => {
    it.each([
      ['/destinations', undefined],
      ['/destinations/1', undefined],
      ['/restaurants', { destinationId: 1 }],
      ['/restaurants/nearby', { lat: 31.78, lng: 35.22 }],
      ['/restaurants/1', undefined],
      ['/reviews/restaurant/1', undefined],
      ['/minyans', { destinationId: 1 }],
      ['/minyans/nearby', { lat: 31.78, lng: 35.22 }],
      ['/minyans/1', undefined],
      ['/synagogues', { destinationId: 1 }],
      ['/synagogues/nearby', { lat: 31.78, lng: 35.22 }],
      ['/synagogues/1', undefined],
      ['/chat/public/1', undefined],
      ['/chat/public/1/posts/1', undefined],
    ])('allows GET %s without a token', async (path, query) => {
      const call = request(app.getHttpServer()).get(path);
      if (query) call.query(query);
      await call.expect(200);
    });

    it('rejects a malformed token on an optional-auth endpoint', async () => {
      await request(app.getHttpServer())
        .get('/minyans/1')
        .set('Authorization', 'Bearer malformed')
        .expect(401);
    });
  });

  describe('protected reads', () => {
    it.each([
      ['/minyans/1/participants', undefined],
      ['/minyans/mine', undefined],
      ['/hosting/summary', { destinationId: 1 }],
      ['/favorites', undefined],
    ])('returns 401 for GET %s without a token', async (path, query) => {
      const call = request(app.getHttpServer()).get(path);
      if (query) call.query(query);
      await call.expect(401);
    });
  });

  describe('protected writes', () => {
    it.each([
      ['/reviews/restaurant/1', { stars: 5 }],
      ['/reviews/restaurant/1/report', { reportType: 'other', description: 'test' }],
      ['/reviews/requests', { entityType: 'restaurant', name: 'Test' }],
      ['/minyans', {}],
      ['/minyans/1/register', {}],
      ['/restaurants/search/feedback', {}],
    ])('returns 401 for POST %s without a token', async (path, body) => {
      await request(app.getHttpServer()).post(path).send(body).expect(401);
    });
  });

  describe('authenticated control', () => {
    it.each([
      ['/destinations', undefined],
      ['/restaurants', { destinationId: 1 }],
      ['/reviews/restaurant/1', undefined],
      ['/minyans', { destinationId: 1 }],
      ['/minyans/1/participants', undefined],
      ['/hosting/summary', { destinationId: 1 }],
      ['/favorites', undefined],
    ])('allows GET %s with a valid test token', async (path, query) => {
      const call = request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer contract-test-token');
      if (query) call.query(query);
      await call.expect(200);
    });
  });
});
