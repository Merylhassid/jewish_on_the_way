import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlaceReview } from './place-review.entity';
import { PlaceReport } from './place-report.entity';
import { PlaceRequest } from './place-request.entity';
import { EntityType } from '../common/enums/entity-type.enum';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReportType } from './dto/create-report.dto';
import { ReportStatus } from './dto/resolve-report.dto';
import { RequestStatus } from './dto/resolve-request.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(PlaceReview)  private reviewRepo:  Repository<PlaceReview>,
    @InjectRepository(PlaceReport)  private reportRepo:  Repository<PlaceReport>,
    @InjectRepository(PlaceRequest) private requestRepo: Repository<PlaceRequest>,
  ) {}

  // ── Reviews ────────────────────────────────────────────────────────────────

  async getReviews(entityType: EntityType, entityId: number, limit = 20, offset = 0) {
    const safeLimit = Math.min(limit, 50);

    const [rows, agg] = await Promise.all([
      this.reviewRepo.find({
        where: { entityType, entityId },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: safeLimit,
        skip: offset,
      }),
      this.reviewRepo
        .createQueryBuilder('r')
        .select('COUNT(*)', 'totalCount')
        .addSelect('AVG(r.stars)', 'avgStars')
        .where('r.entity_type = :entityType AND r.entity_id = :entityId', { entityType, entityId })
        .getRawOne<{ totalCount: string; avgStars: string | null }>(),
    ]);

    const totalCount = parseInt(agg?.totalCount ?? '0', 10);
    const avgRaw = agg?.avgStars ? parseFloat(agg.avgStars) : null;
    const averageStars = avgRaw !== null ? Math.round(avgRaw * 10) / 10 : null;

    return {
      averageStars,
      totalCount,
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
    entityType: EntityType,
    entityId: number,
    stars: number,
    comment?: string,
  ) {
    if (stars < 1 || stars > 5) throw new BadRequestException('stars must be 1–5');

    let review = await this.reviewRepo.findOne({
      where: { userId, entityType, entityId },
    });

    if (review) {
      review.stars = stars;
      review.comment = comment ?? null;
    } else {
      review = this.reviewRepo.create({
        userId, entityType, entityId, stars, comment: comment ?? null,
      });
    }
    return this.reviewRepo.save(review);
  }

  async deleteReview(userId: number, entityType: EntityType, entityId: number) {
    const review = await this.reviewRepo.findOne({
      where: { userId, entityType, entityId },
    });
    if (!review) throw new NotFoundException('Review not found');
    await this.reviewRepo.remove(review);
    return { ok: true };
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async createReport(
    userId: number,
    entityType: EntityType,
    entityId: number,
    reportType: ReportType,
    description?: string,
  ) {
    const report = this.reportRepo.create({
      userId, entityType, entityId, reportType,
      description: description ?? null, status: 'pending',
    });
    return this.reportRepo.save(report);
  }

  // ── Place Requests ─────────────────────────────────────────────────────────

  async createRequest(userId: number, dto: CreateRequestDto) {
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

  async resolveReport(id: number, status: ReportStatus, adminNote?: string) {
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

  async resolveRequest(id: number, status: RequestStatus, adminNote?: string) {
    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    req.status = status;
    req.adminNote = adminNote ?? null;
    return this.requestRepo.save(req);
  }

  async getReportCountByEntity(entityType: EntityType, entityId: number) {
    return this.reportRepo.count({
      where: { entityType, entityId, status: 'pending' },
    });
  }
}
