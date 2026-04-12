import {
  Body,
  Controller,
  Delete,
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

  // POST /admin/destinations/:id/sync — fetch real places from Google
  @Post('destinations/:id/sync')
  @HttpCode(HttpStatus.OK)
  syncDestination(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.syncDestination(id);
  }
}
