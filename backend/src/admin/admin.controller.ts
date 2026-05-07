import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseArrayPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { ManualSynagogueBulkRowDto } from './dto/manual-synagogue-bulk-row.dto';
import { ManualSynagogueImportService } from './manual-synagogue-import.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly manualSynagogueImportService: ManualSynagogueImportService,
  ) {}

  // --- Destinations ---
  @Post('destinations')
  createDestination(@Body() dto: CreateDestinationDto) {
    return this.adminService.createDestination(dto);
  }

  @Delete('destinations/:id')
  @HttpCode(HttpStatus.OK)
  deleteDestination(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteDestination(id);
  }

  // --- Restaurants ---
  @Post('restaurants')
  createRestaurant(@Body() dto: CreateRestaurantDto) {
    return this.adminService.createRestaurant(dto);
  }

  @Delete('restaurants/:id')
  @HttpCode(HttpStatus.OK)
  deleteRestaurant(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteRestaurant(id);
  }

  // POST /admin/destinations/:id/sync — fetch real places from Google
  @Post('destinations/:id/sync')
  @HttpCode(HttpStatus.OK)
  syncDestination(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.syncDestination(id);
  }

  // --- Users ---
  // req 9.4.1 — admin can block (deactivate) any user account
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  blockUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.blockUser(id);
  }

  // --- Chat messages ---
  // req 9.4.1 — admin can delete abusive chat messages
  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  deleteMessage(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteMessage(id);
  }

  // --- Candidate Synagogues (Review & Approval) ---
  // GET /admin/candidates?destinationId=:id&status=pending
  @Get('candidates')
  listCandidateSynagogues(
    @Query('destinationId', ParseIntPipe) destinationId: number,
    @Query('status') status?: 'pending' | 'approved' | 'rejected',
  ) {
    return this.adminService.listCandidateSynagogues(destinationId, status);
  }

  // POST /admin/candidates/:id/approve
  @Post('candidates/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveCandidateSynagogue(@Param('id', ParseIntPipe) candidateId: number) {
    return this.adminService.approveCandidateSynagogue(candidateId);
  }

  // POST /admin/candidates/:id/reject
  @Post('candidates/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectCandidateSynagogue(
    @Param('id', ParseIntPipe) candidateId: number,
    @Body() body?: { reason?: string },
  ) {
    return this.adminService.rejectCandidateSynagogue(
      candidateId,
      body?.reason,
    );
  }

  // POST /admin/synagogues/bulk
  @Post('synagogues/bulk')
  @HttpCode(HttpStatus.OK)
  bulkImportSynagogues(
    @Body(
      new ParseArrayPipe({
        items: ManualSynagogueBulkRowDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    rows: ManualSynagogueBulkRowDto[],
  ) {
    return this.manualSynagogueImportService.bulkImport(rows);
  }
}
