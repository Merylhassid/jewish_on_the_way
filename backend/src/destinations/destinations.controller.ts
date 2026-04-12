import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  // GET /destinations          — req 3.1
  // GET /destinations?q=paris  — req 3.2, 3.2.1
  // req 11.1 — cache full list for 30 s (changes infrequently)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30_000)
  @Get()
  findAll(@Query('q') q?: string) {
    if (q && q.trim()) {
      return this.destinationsService.search(q.trim());
    }
    return this.destinationsService.findAll();
  }

  // GET /destinations/:id      — req 3.3
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.destinationsService.findOne(id);
  }
}
