import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  // GET /destinations          — req 3.1
  // GET /destinations?q=paris  — req 3.2, 3.2.1
  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('parentId') parentId?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const parentIdValue = parentId ? parseInt(parentId, 10) : undefined;
    const latNum = lat ? parseFloat(lat) : undefined;
    const lngNum = lng ? parseFloat(lng) : undefined;
    if (q && q.trim()) {
      return this.destinationsService.search(q.trim(), parentIdValue, latNum, lngNum);
    }
    return this.destinationsService.findAll(parentIdValue, latNum, lngNum);
  }

  // GET /destinations/:id      — req 3.3
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.destinationsService.findOne(id);
  }
}
