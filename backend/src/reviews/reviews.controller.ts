import {
  Body, Controller, Delete, Get, Param, ParseEnumPipe,
  ParseIntPipe, Post, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { ReviewsService } from './reviews.service';
import { EntityType } from '../common/enums/entity-type.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertReviewDto } from './dto/upsert-review.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ResolveRequestDto } from './dto/resolve-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  // ── Static / admin routes first (before dynamic :type/:id params) ──────────

  // POST /reviews/requests  → suggest a new place
  @Post('requests')
  createRequest(
    @Request() req: any,
    @Body() dto: CreateRequestDto,
  ) {
    return this.service.createRequest(req.user.sub, dto);
  }

  @UseGuards(AdminGuard)
  @Get('admin/reports')
  listReports(@Query('status') status?: string) {
    return this.service.listReports(status);
  }

  @UseGuards(AdminGuard)
  @Post('admin/reports/:id/resolve')
  resolveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveReportDto,
  ) {
    return this.service.resolveReport(id, dto.status, dto.adminNote);
  }

  @UseGuards(AdminGuard)
  @Get('admin/requests')
  listRequests(@Query('status') status?: string) {
    return this.service.listRequests(status);
  }

  @UseGuards(AdminGuard)
  @Post('admin/requests/:id/resolve')
  resolveRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveRequestDto,
  ) {
    return this.service.resolveRequest(id, dto.status, dto.adminNote);
  }

  // ── Dynamic :type/:id routes (must come after static routes) ───────────────

  // GET /reviews/:type/:id?limit=20&offset=0  → average stars + list
  @Get(':type/:id')
  getReviews(
    @Param('type', new ParseEnumPipe(EntityType)) type: EntityType,
    @Param('id', ParseIntPipe) id: number,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.service.getReviews(type, id, pagination.limit ?? 20, pagination.offset ?? 0);
  }

  // POST /reviews/:type/:id  → add or update own review
  @Post(':type/:id')
  upsertReview(
    @Request() req: any,
    @Param('type', new ParseEnumPipe(EntityType)) type: EntityType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertReviewDto,
  ) {
    return this.service.upsertReview(req.user.sub, type, id, dto.stars, dto.comment);
  }

  // DELETE /reviews/:type/:id  → remove own review
  @Delete(':type/:id')
  deleteReview(
    @Request() req: any,
    @Param('type', new ParseEnumPipe(EntityType)) type: EntityType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteReview(req.user.sub, type, id);
  }

  // POST /reviews/:type/:id/report  → report a place
  @Post(':type/:id/report')
  createReport(
    @Request() req: any,
    @Param('type', new ParseEnumPipe(EntityType)) type: EntityType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReportDto,
  ) {
    return this.service.createReport(req.user.sub, type, id, dto.reportType, dto.description);
  }
}
