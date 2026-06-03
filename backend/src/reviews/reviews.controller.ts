import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Post, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { ReviewsService } from './reviews.service';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  // GET /reviews/:type/:id  → average stars + list
  @Get(':type/:id')
  getReviews(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getReviews(type, id);
  }

  // POST /reviews/:type/:id  → add or update own review
  @Post(':type/:id')
  upsertReview(
    @Request() req: any,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { stars: number; comment?: string },
  ) {
    return this.service.upsertReview(req.user.sub, type, id, body.stars, body.comment);
  }

  // DELETE /reviews/:type/:id  → remove own review
  @Delete(':type/:id')
  deleteReview(
    @Request() req: any,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteReview(req.user.sub, type, id);
  }

  // POST /reviews/:type/:id/report  → report a place
  @Post(':type/:id/report')
  createReport(
    @Request() req: any,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reportType: string; description?: string },
  ) {
    return this.service.createReport(req.user.sub, type, id, body.reportType, body.description);
  }

  // POST /reviews/requests  → suggest a new place
  @Post('requests')
  createRequest(
    @Request() req: any,
    @Body() body: {
      entityType: string;
      destinationId: number;
      name: string;
      address?: string;
      phone?: string;
      websiteUrl?: string;
      notes?: string;
      kashrutLevel?: string;
      restaurantType?: string;
      nusach?: string;
      denomination?: string;
    },
  ) {
    return this.service.createRequest(req.user.sub, body);
  }

  // ── Admin endpoints ────────────────────────────────────────────────────────

  @UseGuards(AdminGuard)
  @Get('admin/reports')
  listReports(@Query('status') status?: string) {
    return this.service.listReports(status);
  }

  @UseGuards(AdminGuard)
  @Post('admin/reports/:id/resolve')
  resolveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string; adminNote?: string },
  ) {
    return this.service.resolveReport(id, body.status, body.adminNote);
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
    @Body() body: { status: string; adminNote?: string },
  ) {
    return this.service.resolveRequest(id, body.status, body.adminNote);
  }
}
