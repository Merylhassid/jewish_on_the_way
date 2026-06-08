import {
  Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';
import { EntityType } from '../common/enums/entity-type.enum';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  // GET /favorites — all saved items for current user
  @Get()
  getAll(@Request() req: any) {
    return this.service.getAll(req.user.sub);
  }

  // GET /favorites/:type/:id — check if saved
  @Get(':type/:id')
  isSaved(
    @Request() req: any,
    @Param('type', new ParseEnumPipe(EntityType)) type: EntityType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.isSaved(req.user.sub, type, id);
  }

  // POST /favorites/:type/:id — toggle save/unsave
  @Post(':type/:id')
  toggle(
    @Request() req: any,
    @Param('type', new ParseEnumPipe(EntityType)) type: EntityType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.toggle(req.user.sub, type, id);
  }
}
