import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { PlaceReview } from './place-review.entity';
import { PlaceReport } from './place-report.entity';
import { PlaceRequest } from './place-request.entity';
import { User } from '../users/user.entity';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';
import { MailService } from '../mail/mail.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const makeUser = (): Partial<User> => ({
  id: 1,
  firstName: 'Dani',
  lastName: 'Cohen',
  email: 'dani@example.com',
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepo: ReturnType<typeof mockRepo>;
  let reportRepo: ReturnType<typeof mockRepo>;
  let requestRepo: ReturnType<typeof mockRepo>;
  let usersRepo: ReturnType<typeof mockRepo>;
  let restaurantRepo: ReturnType<typeof mockRepo>;
  let synagogueRepo: ReturnType<typeof mockRepo>;
  let mail: { sendReportNotification: jest.Mock; sendRequestNotification: jest.Mock };

  beforeEach(async () => {
    reviewRepo    = mockRepo();
    reportRepo    = mockRepo();
    requestRepo   = mockRepo();
    usersRepo     = mockRepo();
    restaurantRepo = mockRepo();
    synagogueRepo = mockRepo();
    mail = {
      sendReportNotification:  jest.fn().mockResolvedValue(undefined),
      sendRequestNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(PlaceReview),  useValue: reviewRepo },
        { provide: getRepositoryToken(PlaceReport),  useValue: reportRepo },
        { provide: getRepositoryToken(PlaceRequest), useValue: requestRepo },
        { provide: getRepositoryToken(User),         useValue: usersRepo },
        { provide: getRepositoryToken(Restaurant),   useValue: restaurantRepo },
        { provide: getRepositoryToken(Synagogue),    useValue: synagogueRepo },
        { provide: MailService,                      useValue: mail },
      ],
    }).compile();

    service = module.get(ReviewsService);
  });

  // ── getReviews ─────────────────────────────────────────────────────────────

  describe('getReviews', () => {
    it('returns reviews with averageStars and totalCount', async () => {
      const fakeReview = {
        id: 1, stars: 4, comment: 'Good', createdAt: new Date(),
        user: { firstName: 'Dani', lastName: 'Cohen' },
      };
      reviewRepo.find.mockResolvedValue([fakeReview]);
      reviewRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalCount: '1', avgStars: '4.0' }),
      });

      const result = await service.getReviews('restaurant', 10);

      expect(result.totalCount).toBe(1);
      expect(result.averageStars).toBe(4);
      expect(result.reviews[0].stars).toBe(4);
      expect(result.reviews[0].user.firstName).toBe('Dani');
    });

    it('returns null averageStars when there are no reviews', async () => {
      reviewRepo.find.mockResolvedValue([]);
      reviewRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalCount: '0', avgStars: null }),
      });

      const result = await service.getReviews('restaurant', 10);

      expect(result.totalCount).toBe(0);
      expect(result.averageStars).toBeNull();
      expect(result.reviews).toHaveLength(0);
    });

    it('caps limit at 50', async () => {
      reviewRepo.find.mockResolvedValue([]);
      reviewRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalCount: '0', avgStars: null }),
      });

      await service.getReviews('restaurant', 10, 999);

      expect(reviewRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  // ── upsertReview ───────────────────────────────────────────────────────────

  describe('upsertReview', () => {
    it('throws BadRequestException when stars is out of range', async () => {
      await expect(service.upsertReview(1, 'restaurant', 10, 0)).rejects.toThrow(BadRequestException);
      await expect(service.upsertReview(1, 'restaurant', 10, 6)).rejects.toThrow(BadRequestException);
    });

    it('creates a new review when none exists', async () => {
      reviewRepo.findOne.mockResolvedValue(null);
      const created = { id: 1, stars: 5, comment: 'Great' };
      reviewRepo.create.mockReturnValue(created);
      reviewRepo.save.mockResolvedValue(created);

      const result = await service.upsertReview(1, 'restaurant', 10, 5, 'Great');

      expect(reviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, stars: 5, comment: 'Great' }),
      );
      expect(result.stars).toBe(5);
    });

    it('updates an existing review', async () => {
      const existing = { id: 1, stars: 3, comment: 'Ok' };
      reviewRepo.findOne.mockResolvedValue(existing);
      reviewRepo.save.mockResolvedValue({ ...existing, stars: 5, comment: 'Great' });

      const result = await service.upsertReview(1, 'restaurant', 10, 5, 'Great');

      expect(reviewRepo.create).not.toHaveBeenCalled();
      expect(result.stars).toBe(5);
    });
  });

  // ── deleteReview ───────────────────────────────────────────────────────────

  describe('deleteReview', () => {
    it('throws NotFoundException when review does not exist', async () => {
      reviewRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteReview(1, 'restaurant', 10)).rejects.toThrow(NotFoundException);
    });

    it('removes the review and returns ok', async () => {
      const review = { id: 1 };
      reviewRepo.findOne.mockResolvedValue(review);
      reviewRepo.remove.mockResolvedValue(review);

      const result = await service.deleteReview(1, 'restaurant', 10);

      expect(reviewRepo.remove).toHaveBeenCalledWith(review);
      expect(result).toEqual({ ok: true });
    });
  });

  // ── createReport ───────────────────────────────────────────────────────────

  describe('createReport', () => {
    it('saves the report and sends an email notification', async () => {
      const saved = { id: 1, status: 'pending' };
      reportRepo.create.mockReturnValue(saved);
      reportRepo.save.mockResolvedValue(saved);
      usersRepo.findOne.mockResolvedValue(makeUser());
      restaurantRepo.findOne.mockResolvedValue({ id: 10, name: 'Resto', address: 'Addr', phone: '050', city: 'Tel Aviv' });

      const result = await service.createReport(1, 'restaurant', 10, 'wrong_info', 'bad phone');

      expect(result.status).toBe('pending');
      await new Promise(r => setTimeout(r, 10));
      expect(mail.sendReportNotification).toHaveBeenCalledWith(
        expect.objectContaining({ placeName: 'Resto', placeCity: 'Tel Aviv' }),
      );
    });

    it('does not throw when mail fails', async () => {
      const saved = { id: 1, status: 'pending' };
      reportRepo.create.mockReturnValue(saved);
      reportRepo.save.mockResolvedValue(saved);
      usersRepo.findOne.mockResolvedValue(makeUser());
      restaurantRepo.findOne.mockResolvedValue({ id: 10, name: 'Resto', address: 'Addr', phone: null, city: null });
      mail.sendReportNotification.mockRejectedValue(new Error('SMTP down'));

      await expect(service.createReport(1, 'restaurant', 10, 'wrong_info')).resolves.toBeDefined();
    });
  });

  // ── createRequest ──────────────────────────────────────────────────────────

  describe('createRequest', () => {
    it('throws BadRequestException when name or entityType is missing', async () => {
      await expect(
        service.createRequest(1, { name: '', entityType: 'restaurant' } as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createRequest(1, { name: 'Bistro', entityType: '' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('saves the request and sends an email notification', async () => {
      const dto = { name: 'New Place', entityType: 'restaurant', city: 'Haifa', address: 'Herzl 1', phone: '050', notes: '' } as any;
      const saved = { id: 5, status: 'pending', ...dto };
      requestRepo.create.mockReturnValue(saved);
      requestRepo.save.mockResolvedValue(saved);
      usersRepo.findOne.mockResolvedValue(makeUser());

      const result = await service.createRequest(1, dto);

      expect(result.status).toBe('pending');
      await new Promise(r => setTimeout(r, 10));
      expect(mail.sendRequestNotification).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Place', city: 'Haifa' }),
      );
    });
  });

  // ── resolveReport ──────────────────────────────────────────────────────────

  describe('resolveReport', () => {
    it('throws NotFoundException when report does not exist', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.resolveReport(99, 'resolved')).rejects.toThrow(NotFoundException);
    });

    it('updates the report status and saves', async () => {
      const report = { id: 1, status: 'pending', adminNote: null };
      reportRepo.findOne.mockResolvedValue(report);
      reportRepo.save.mockResolvedValue({ ...report, status: 'resolved', adminNote: 'fixed' });

      const result = await service.resolveReport(1, 'resolved', 'fixed');

      expect(result.status).toBe('resolved');
      expect(result.adminNote).toBe('fixed');
    });
  });

  // ── resolveRequest ─────────────────────────────────────────────────────────

  describe('resolveRequest', () => {
    it('throws NotFoundException when request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.resolveRequest(99, 'approved')).rejects.toThrow(NotFoundException);
    });

    it('updates the request status and saves', async () => {
      const req = { id: 2, status: 'pending', adminNote: null };
      requestRepo.findOne.mockResolvedValue(req);
      requestRepo.save.mockResolvedValue({ ...req, status: 'approved', adminNote: null });

      const result = await service.resolveRequest(2, 'approved');

      expect(result.status).toBe('approved');
    });
  });
});
