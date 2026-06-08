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
import { CreateMinyanDto } from './dto/create-minyan.dto';
import { UpdateMinyanDto } from './dto/update-minyan.dto';

@UseGuards(JwtAuthGuard)
@Controller('minyans')
export class MinyansController {
  constructor(private readonly minyansService: MinyansService) {}

  // GET /minyans/mine — המניינים של המשתמש
  @Get('mine')
  findMine(@Req() req: any) {
    return this.minyansService.findMine(req.user.sub);
  }

  // GET /minyans/nearby?lat=48.8&lng=2.3&radius=5
  @Get('nearby')
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.minyansService.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 10,
    );
  }

  // GET /minyans?destinationId=1&prayerType=shacharit&date=2026-04-20&lat=48.8&lng=2.3
  @Get()
  findAll(
    @Query('destinationId', ParseIntPipe) destinationId: number,
    @Query('prayerType') prayerType?: string,
    @Query('date') date?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.minyansService.findUpcoming(destinationId, {
      prayerType,
      date,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    });
  }

  // GET /minyans/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.findOne(id, req.user.sub);
  }

  // GET /minyans/:id/participants
  @Get(':id/participants')
  getParticipants(@Param('id', ParseIntPipe) id: number) {
    return this.minyansService.getParticipants(id);
  }

  // POST /minyans
  @Post()
  create(@Body() dto: CreateMinyanDto, @Req() req: any) {
    return this.minyansService.create(dto, req.user.sub);
  }

  // PATCH /minyans/:id — יוצר בלבד
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMinyanDto,
    @Req() req: any,
  ) {
    return this.minyansService.update(id, dto, req.user.sub);
  }

  // POST /minyans/:id/register
  @Post(':id/register')
  @HttpCode(HttpStatus.OK)
  register(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.register(id, req.user.sub);
  }

  // DELETE /minyans/:id/register
  @Delete(':id/register')
  @HttpCode(HttpStatus.OK)
  unregister(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.unregister(id, req.user.sub);
  }

  // DELETE /minyans/:id  — יוצר בלבד
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteMinyan(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.deleteMinyan(id, req.user.sub);
  }
}
