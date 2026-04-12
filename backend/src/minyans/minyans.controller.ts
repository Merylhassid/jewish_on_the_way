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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MinyansService } from './minyans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMinyanDto } from './dto/create-minyan.dto';

@UseGuards(JwtAuthGuard)
@Controller('minyans')
export class MinyansController {
  constructor(private readonly minyansService: MinyansService) {}

  // GET /minyans?destinationId=1&prayerType=shacharit&date=2026-04-20
  @Get()
  findAll(
    @Query('destinationId', ParseIntPipe) destinationId: number,
    @Query('prayerType') prayerType?: string,
    @Query('date') date?: string,
  ) {
    return this.minyansService.findUpcoming(destinationId, { prayerType, date });
  }

  // GET /minyans/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.minyansService.findOne(id, req.user.sub);
  }

  // POST /minyans
  @Post()
  create(@Body() dto: CreateMinyanDto, @Req() req: any) {
    return this.minyansService.create(dto, req.user.sub);
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
}
