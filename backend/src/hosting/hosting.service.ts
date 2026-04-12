import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HostingOffer } from './entities/hosting-offer.entity';
import { HostingRequest } from './entities/hosting-request.entity';
import { Destination } from '../destination.entity';
import { User } from '../users/user.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class HostingService {
  constructor(
    @InjectRepository(HostingOffer) private offersRepo: Repository<HostingOffer>,
    @InjectRepository(HostingRequest) private requestsRepo: Repository<HostingRequest>,
    @InjectRepository(Destination) private destinationsRepo: Repository<Destination>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private audit: AuditService,
  ) {}

  // ── Host: create offer ──────────────────────────────────────────────────────

  async createOffer(dto: CreateOfferDto, userId: number) {
    const destination = await this.destinationsRepo.findOne({
      where: { id: dto.destinationId },
    });
    if (!destination) throw new NotFoundException('Destination not found');

    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });

    const offer = Object.assign(this.offersRepo.create(), {
      user,
      destination,
      available_from: dto.availableFrom as unknown as Date,
      available_to: dto.availableTo as unknown as Date,
      max_guests: dto.maxGuests,
      allows_children: dto.allowsChildren,
      allows_shabbat: dto.allowsShabbat,
      kashrut_level: dto.kashrutLevel ?? null,
      notes: dto.notes ?? null,
      is_active: true,
    });

    const saved = (await this.offersRepo.save(offer)) as HostingOffer;
    this.audit.log('HOSTING_OFFER_CREATED', userId, {
      offerId: saved.id,
      destinationId: dto.destinationId,
    });
    return this.formatOffer(saved);
  }

  // ── Host: list my offers ────────────────────────────────────────────────────

  async myOffers(userId: number) {
    const offers = await this.offersRepo.find({
      where: { user: { id: userId } },
      relations: ['destination'],
      order: { created_at: 'DESC' },
    });
    return offers.map(this.formatOffer);
  }

  // ── Host: deactivate offer ───────────────────────────────────────────────────

  async deactivateOffer(offerId: number, userId: number) {
    const offer = await this.offersRepo.findOne({
      where: { id: offerId },
      relations: ['user'],
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.user.id !== userId) throw new ForbiddenException('Not your offer');
    offer.is_active = false;
    await this.offersRepo.save(offer);
    this.audit.log('HOSTING_OFFER_DEACTIVATED', userId, { offerId });
    return { success: true };
  }

  // ── Guest: search offers — req 7.2.5 / 7.2.6 ───────────────────────────────

  async searchOffers(filters: {
    destinationId: number;
    arrivalDate?: string;
    departureDate?: string;
    guestsCount?: number;
    forShabbat?: boolean;
    withChildren?: boolean;
  }) {
    const qb = this.offersRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.destination', 'd')
      .where('o.destination_id = :destinationId', { destinationId: filters.destinationId })
      .andWhere('o.is_active = true');

    if (filters.guestsCount) {
      qb.andWhere('o.max_guests >= :guests', { guests: filters.guestsCount });
    }
    if (filters.forShabbat) {
      qb.andWhere('o.allows_shabbat = true');
    }
    if (filters.withChildren) {
      qb.andWhere('o.allows_children = true');
    }
    if (filters.arrivalDate) {
      qb.andWhere('o.available_from <= :arrival', { arrival: filters.arrivalDate });
    }
    if (filters.departureDate) {
      qb.andWhere('o.available_to >= :departure', { departure: filters.departureDate });
    }

    const offers = await qb.orderBy('o.created_at', 'DESC').getMany();

    // req 7.4.5 — never expose contact details in search results
    return offers.map(this.formatOffer);
  }

  // ── Guest: send request — req 7.2.7 ────────────────────────────────────────

  async createRequest(dto: CreateRequestDto, guestId: number) {
    if (dto.arrivalDate >= dto.departureDate) {
      throw new BadRequestException('Departure must be after arrival');
    }

    const offer = await this.offersRepo.findOne({
      where: { id: dto.offerId, is_active: true },
      relations: ['destination', 'user'],
    });
    if (!offer) throw new NotFoundException('Hosting offer not found');

    const guest = await this.usersRepo.findOneOrFail({ where: { id: guestId } });

    // req 7.4.5 — guest cannot request their own offer
    if (offer.user.id === guestId) {
      throw new BadRequestException('Cannot request your own hosting offer');
    }

    const request = Object.assign(this.requestsRepo.create(), {
      user: guest,
      destination: offer.destination,
      offer,
      arrival_date: dto.arrivalDate,
      departure_date: dto.departureDate,
      guests_count: dto.guestsCount,
      with_children: dto.withChildren,
      for_shabbat: dto.forShabbat,
      special_requests: dto.specialRequests ?? null,
      status: 'pending' as const,
    });

    const saved = (await this.requestsRepo.save(request)) as HostingRequest;
    this.audit.log('HOSTING_REQUEST_SENT', guestId, {
      requestId: saved.id,
      offerId: dto.offerId,
      destinationId: offer.destination.id,
    });
    return this.formatRequest(saved, guestId);
  }

  // ── Guest: my sent requests ─────────────────────────────────────────────────

  async myRequests(userId: number) {
    const requests = await this.requestsRepo.find({
      where: { user: { id: userId } },
      relations: ['destination', 'offer', 'offer.user'],
      order: { created_at: 'DESC' },
    });
    return requests.map((r) => this.formatRequest(r, userId));
  }

  // ── Host: requests received for my offers ───────────────────────────────────

  async requestsReceived(hostId: number) {
    const requests = await this.requestsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'guest')
      .leftJoinAndSelect('r.destination', 'd')
      .leftJoinAndSelect('r.offer', 'o')
      .where('o.user_id = :hostId', { hostId })
      .orderBy('r.created_at', 'DESC')
      .getMany();

    // req 7.4.5 — only expose guest contact when approved
    return requests.map((r) => this.formatRequest(r, hostId));
  }

  // ── Host: approve / reject ──────────────────────────────────────────────────

  async updateRequestStatus(
    requestId: number,
    hostId: number,
    status: 'approved' | 'rejected',
  ) {
    const request = await this.requestsRepo.findOne({
      where: { id: requestId },
      relations: ['offer', 'offer.user'],
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.offer?.user?.id !== hostId) {
      throw new ForbiddenException('Not your hosting offer');
    }

    request.status = status;
    const updated = (await this.requestsRepo.save(request)) as HostingRequest;
    this.audit.log(
      status === 'approved' ? 'HOSTING_REQUEST_APPROVED' : 'HOSTING_REQUEST_REJECTED',
      hostId,
      { requestId: requestId },
    );
    return this.formatRequest(updated, hostId);
  }

  // ── Formatters ──────────────────────────────────────────────────────────────

  private formatOffer(o: HostingOffer) {
    return {
      id: o.id,
      availableFrom: o.available_from,
      availableTo: o.available_to,
      maxGuests: o.max_guests,
      allowsChildren: o.allows_children,
      allowsShabbat: o.allows_shabbat,
      kashrutLevel: o.kashrut_level,
      notes: o.notes,
      destination: o.destination
        ? { id: o.destination.id, city: o.destination.city, country: o.destination.country }
        : null,
      // req 7.4.5 — only first name shown in search; full contact hidden
      host: o.user
        ? { id: o.user.id, firstName: o.user.firstName }
        : null,
    };
  }

  private formatRequest(r: HostingRequest, viewerId: number) {
    const isApproved = r.status === 'approved';
    const isHost = r.offer?.user?.id === viewerId;

    return {
      id: r.id,
      status: r.status,
      arrivalDate: r.arrival_date,
      departureDate: r.departure_date,
      guestsCount: r.guests_count,
      withChildren: r.with_children,
      forShabbat: r.for_shabbat,
      specialRequests: r.special_requests,
      createdAt: r.created_at,
      destination: r.destination
        ? { id: r.destination.id, city: r.destination.city }
        : null,
      // req 7.4.5 — reveal full contact details only after approval
      guest: r.user
        ? {
            id: r.user.id,
            firstName: r.user.firstName,
            // Only expose last name + email to host after approval
            ...(isHost && isApproved
              ? { lastName: r.user.lastName, email: r.user.email }
              : {}),
          }
        : null,
      offer: r.offer ? { id: r.offer.id } : null,
    };
  }
}
