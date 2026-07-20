import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MinyansService } from './minyans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateMinyanDto } from './dto/create-minyan.dto';
import { UpdateMinyanDto } from './dto/update-minyan.dto';

@Controller('minyans')
export class MinyansController {
  constructor(private readonly minyansService: MinyansService) {}

  // GET /minyans/mine — המניינים של המשתמש
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@Req() req: any) {
    return this.minyansService.findMine(req.user.sub);
  }

  // GET /minyans/nearby?lat=48.8&lng=2.3&radius=5
  @UseGuards(OptionalJwtAuthGuard)
  @Get('nearby')
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Req() req?: any,
  ) {
    return this.minyansService.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 10,
      Boolean(req?.user),
    );
  }

  // GET /minyans?destinationId=1&prayerType=shacharit&date=2026-04-20&lat=48.8&lng=2.3
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(
    @Query('destinationId', ParseIntPipe) destinationId: number,
    @Query('prayerType') prayerType?: string,
    @Query('date') date?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Req() req?: any,
  ) {
    return this.minyansService.findUpcoming(destinationId, {
      prayerType,
      date,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    }, Boolean(req?.user));
  }

  // GET /minyans/:id
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.findOne(id, req.user?.sub);
  }

  // GET /minyans/:id/participants
  @UseGuards(JwtAuthGuard)
  @Get(':id/participants')
  getParticipants(@Param('id', ParseIntPipe) id: number) {
    return this.minyansService.getParticipants(id);
  }

  // POST /minyans
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateMinyanDto, @Req() req: any) {
    return this.minyansService.create(dto, req.user.sub);
  }

  // PATCH /minyans/:id — יוצר בלבד
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMinyanDto,
    @Req() req: any,
  ) {
    return this.minyansService.update(id, dto, req.user.sub);
  }

  // POST /minyans/:id/register
  @UseGuards(JwtAuthGuard)
  @Post(':id/register')
  @HttpCode(HttpStatus.OK)
  register(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.register(id, req.user.sub);
  }

  // DELETE /minyans/:id/register
  @UseGuards(JwtAuthGuard)
  @Delete(':id/register')
  @HttpCode(HttpStatus.OK)
  unregister(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.unregister(id, req.user.sub);
  }

  // DELETE /minyans/:id  — יוצר בלבד
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteMinyan(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.deleteMinyan(id, req.user.sub);
  }
}
