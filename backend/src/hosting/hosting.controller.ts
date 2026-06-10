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
import { HostingService } from './hosting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateNeedDto } from './dto/create-need.dto';
import { SearchOffersQueryDto } from './dto/search-offers-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('hosting')
export class HostingController {
  constructor(private readonly hostingService: HostingService) {}

  // ── Offers ─────────────────────────────────────────────────────────────────

  @Post('offers')
  createOffer(@Body() dto: CreateOfferDto, @Req() req: any) {
    return this.hostingService.createOffer(dto, req.user.sub);
  }

  @Get('offers/mine')
  myOffers(@Req() req: any) {
    return this.hostingService.myOffers(req.user.sub);
  }

  @Post('offers/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivateOffer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.deactivateOffer(id, req.user.sub);
  }

  @Delete('offers/:id')
  @HttpCode(HttpStatus.OK)
  deleteOffer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.deleteOffer(id, req.user.sub);
  }

  // GET /hosting/offers/search?destinationId=1&guestsCount=2&forShabbat=true&arrivalDate=2026-05-01&limit=20&offset=0
  @Get('offers/search')
  searchOffers(@Query() dto: SearchOffersQueryDto) {
    return this.hostingService.searchOffers({
      destinationId: dto.destinationId,
      arrivalDate: dto.arrivalDate,
      departureDate: dto.departureDate,
      guestsCount: dto.guestsCount,
      forShabbat: dto.forShabbat ?? false,
      withChildren: dto.withChildren ?? false,
      limit: dto.limit ?? 20,
      offset: dto.offset ?? 0,
    });
  }

  // ── Requests ────────────────────────────────────────────────────────────────

  @Post('requests')
  createRequest(@Body() dto: CreateRequestDto, @Req() req: any) {
    return this.hostingService.createRequest(dto, req.user.sub);
  }

  @Get('requests/mine')
  myRequests(@Req() req: any) {
    return this.hostingService.myRequests(req.user.sub);
  }

  @Get('requests/received')
  requestsReceived(@Req() req: any) {
    return this.hostingService.requestsReceived(req.user.sub);
  }

  @Post('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.updateRequestStatus(
      id,
      req.user.sub,
      'approved',
    );
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.updateRequestStatus(id, req.user.sub, 'rejected');
  }

  @Post('requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelRequest(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.cancelRequest(id, req.user.sub);
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.OK)
  deleteRequest(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.deleteRequest(id, req.user.sub);
  }

  // ── Needs ───────────────────────────────────────────────────────────────────

  @Post('needs')
  createNeed(@Body() dto: CreateNeedDto, @Req() req: any) {
    return this.hostingService.createNeed(dto, req.user.sub);
  }

  @Get('needs')
  listNeeds(@Query('destinationId') destinationId?: string) {
    return this.hostingService.listNeeds(destinationId ? parseInt(destinationId, 10) : undefined);
  }

  @Get('needs/mine')
  myNeeds(@Req() req: any) {
    return this.hostingService.myNeeds(req.user.sub);
  }

  @Patch('needs/:id/close')
  @HttpCode(HttpStatus.OK)
  closeNeed(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.closeNeed(id, req.user.sub);
  }

  @Delete('needs/:id')
  @HttpCode(HttpStatus.OK)
  deleteNeed(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.deleteNeed(id, req.user.sub);
  }

  @Post('needs/:id/respond')
  @HttpCode(HttpStatus.OK)
  respondToNeed(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.respondToNeed(id, req.user.sub);
  }
}
