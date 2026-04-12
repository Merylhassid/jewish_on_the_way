import {
  Body,
  Controller,
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
import { HostingService } from './hosting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateRequestDto } from './dto/create-request.dto';

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

  // GET /hosting/offers/search?destinationId=1&guestsCount=2&forShabbat=true&arrivalDate=2026-05-01
  @Get('offers/search')
  searchOffers(
    @Query('destinationId', ParseIntPipe) destinationId: number,
    @Query('arrivalDate') arrivalDate?: string,
    @Query('departureDate') departureDate?: string,
    @Query('guestsCount') guestsCount?: string,
    @Query('forShabbat') forShabbat?: string,
    @Query('withChildren') withChildren?: string,
  ) {
    return this.hostingService.searchOffers({
      destinationId,
      arrivalDate,
      departureDate,
      guestsCount: guestsCount ? parseInt(guestsCount, 10) : undefined,
      forShabbat: forShabbat === 'true',
      withChildren: withChildren === 'true',
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
    return this.hostingService.updateRequestStatus(id, req.user.sub, 'approved');
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.hostingService.updateRequestStatus(id, req.user.sub, 'rejected');
  }
}
