import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { AuditDestinationsDto } from './dto/audit-destinations.dto';
import { CleanupDestinationsDto } from './dto/cleanup-destinations.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  // POST /admin/destinations/:id/sync — fetch real places from Google for one city
  @Post('destinations/:id/sync')
  @HttpCode(HttpStatus.OK)
  syncDestination(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.syncDestination(id);
  }

  // POST /admin/destinations/sync-all — fetch real places from Google for ALL cities
  @Post('destinations/sync-all')
  @HttpCode(HttpStatus.OK)
  syncAllDestinations() {
    return this.adminService.syncAllDestinations();
  }

  // GET /admin/destinations/with-restaurants — discover which destination IDs have restaurant data
  @Get('destinations/with-restaurants')
  getDestinationsWithRestaurants() {
    return this.adminService.getDestinationsWithRestaurants();
  }

  // POST /admin/destinations/resync — re-fetch from Google for specific destination IDs only
  @Post('destinations/resync')
  @HttpCode(HttpStatus.OK)
  resyncDestinations(@Body() dto: AuditDestinationsDto) {
    return this.adminService.resyncDestinations(dto.destinationIds);
  }

  // POST /admin/destinations/audit — scan specific destinations for non-kosher restaurants (no writes)
  @Post('destinations/audit')
  @HttpCode(HttpStatus.OK)
  auditDestinations(@Body() dto: AuditDestinationsDto) {
    return this.adminService.auditDestinations(dto.destinationIds);
  }

  // POST /admin/destinations/cleanup — dry-run (confirm:false) or delete (confirm:true) non-kosher
  @Post('destinations/cleanup')
  @HttpCode(HttpStatus.OK)
  cleanupDestinations(@Body() dto: CleanupDestinationsDto) {
    return this.adminService.cleanupDestinations(dto.destinationIds, dto.confirm);
  }

  // POST /admin/destinations/revalidate — reclassify + remove non-kosher in specific destinations
  @Post('destinations/revalidate')
  @HttpCode(HttpStatus.OK)
  revalidateDestinations(@Body() dto: AuditDestinationsDto) {
    return this.adminService.revalidateDestinations(dto.destinationIds);
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
}
