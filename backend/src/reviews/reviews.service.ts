import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlaceReview } from './place-review.entity';
import { PlaceReport } from './place-report.entity';
import { PlaceRequest } from './place-request.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(PlaceReview)  private reviewRepo:  Repository<PlaceReview>,
    @InjectRepository(PlaceReport)  private reportRepo:  Repository<PlaceReport>,
    @InjectRepository(PlaceRequest) private requestRepo: Repository<PlaceRequest>,
  ) {}

  // ── Reviews ────────────────────────────────────────────────────────────────

  async getReviews(entityType: string, entityId: number) {
    const rows = await this.reviewRepo.find({
      where: { entityType: entityType as any, entityId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const avg = rows.length
      ? rows.reduce((s, r) => s + r.stars, 0) / rows.length
      : null;

    return {
      average: avg ? Math.round(avg * 10) / 10 : null,
      count: rows.length,
      reviews: rows.map(r => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        createdAt: r.createdAt,
        user: { firstName: r.user.firstName, lastName: r.user.lastName },
      })),
    };
  }

  async upsertReview(
    userId: number,
    entityType: string,
    entityId: number,
    stars: number,
    comment?: string,
  ) {
    if (stars < 1 || stars > 5) throw new BadRequestException('stars must be 1–5');

    let review = await this.reviewRepo.findOne({
      where: { userId, entityType: entityType as any, entityId },
    });

    if (review) {
      review.stars = stars;
      review.comment = comment ?? null;
    } else {
      review = this.reviewRepo.create({
        userId, entityType: entityType as any, entityId, stars, comment: comment ?? null,
      });
    }
    return this.reviewRepo.save(review);
  }

  async deleteReview(userId: number, entityType: string, entityId: number) {
    const review = await this.reviewRepo.findOne({
      where: { userId, entityType: entityType as any, entityId },
    });
    if (!review) throw new NotFoundException('Review not found');
    await this.reviewRepo.remove(review);
    return { ok: true };
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async createReport(
    userId: number,
    entityType: string,
    entityId: number,
    reportType: string,
    description?: string,
  ) {
    const report = this.reportRepo.create({
      userId, entityType: entityType as any, entityId, reportType,
      description: description ?? null, status: 'pending',
    });
    return this.reportRepo.save(report);
  }

  // ── Place Requests ─────────────────────────────────────────────────────────

  async createRequest(userId: number, dto: Partial<PlaceRequest>) {
    if (!dto.name || !dto.destinationId || !dto.entityType) {
      throw new BadRequestException('name, destinationId and entityType are required');
    }
    const req = this.requestRepo.create({ ...dto, userId, status: 'pending' });
    return this.requestRepo.save(req);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async listReports(status?: string) {
    const where = status ? { status } : {};
    return this.reportRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async resolveReport(id: number, status: string, adminNote?: string) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = status;
    report.adminNote = adminNote ?? null;
    return this.reportRepo.save(report);
  }

  async listRequests(status?: string) {
    const where = status ? { status } : {};
    return this.requestRepo.find({
      where,
      relations: ['user', 'destination'],
      order: { createdAt: 'DESC' },
    });
  }

  async resolveRequest(id: number, status: string, adminNote?: string) {
    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    req.status = status;
    req.adminNote = adminNote ?? null;
    return this.requestRepo.save(req);
  }

  async getReportCountByEntity(entityType: string, entityId: number) {
    return this.reportRepo.count({
      where: { entityType: entityType as any, entityId, status: 'pending' },
    });
  }
}
