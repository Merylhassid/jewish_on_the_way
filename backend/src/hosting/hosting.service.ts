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
import { HostingNeed } from './entities/hosting-need.entity';
import { Destination } from '../destination.entity';
import { User } from '../users/user.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateNeedDto } from './dto/create-need.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class HostingService {
  constructor(
    @InjectRepository(HostingOffer)
    private offersRepo: Repository<HostingOffer>,
    @InjectRepository(HostingRequest)
    private requestsRepo: Repository<HostingRequest>,
    @InjectRepository(HostingNeed)
    private needsRepo: Repository<HostingNeed>,
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private audit: AuditService,
    private notifications: NotificationsService,
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
    if (offer.user.id !== userId)
      throw new ForbiddenException('Not your offer');
    offer.is_active = false;
    await this.offersRepo.save(offer);
    this.audit.log('HOSTING_OFFER_DEACTIVATED', userId, { offerId });
    return { success: true };
  }

  async deleteOffer(offerId: number, userId: number) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId }, relations: ['user'] });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.user.id !== userId) throw new ForbiddenException('Not your offer');
    await this.offersRepo.delete(offerId);
    return { success: true };
  }

  async cancelRequest(requestId: number, userId: number) {
    const request = await this.requestsRepo.findOne({
      where: { id: requestId },
      relations: ['user', 'offer', 'offer.user'],
    });
    if (!request) throw new NotFoundException('Request not found');

    const isGuest = request.user?.id === userId;
    const isHost  = request.offer?.user?.id === userId || request.host_id === userId;
    if (!isGuest && !isHost) throw new ForbiddenException('Not your request');
    if (request.status !== 'approved') throw new BadRequestException('Only approved requests can be cancelled');

    request.status = 'cancelled';
    await this.requestsRepo.save(request);
    this.audit.log('HOSTING_REQUEST_CANCELLED', userId, { requestId });

    // Notify the other party
    const otherUserId = isGuest ? (request.offer?.user?.id ?? request.host_id) : request.user?.id;
    if (otherUserId) {
      const other = await this.usersRepo.findOne({ where: { id: otherUserId } });
      if (other?.pushToken) {
        const cancellerName = isGuest ? request.user?.firstName : 'The host';
        void this.notifications.sendPush(
          other.pushToken,
          'Hosting request cancelled',
          `${cancellerName} has cancelled the hosting arrangement`,
          { requestId },
        );
      }
    }

    return { success: true };
  }

  async deleteRequest(requestId: number, userId: number) {
    const request = await this.requestsRepo.findOne({
      where: { id: requestId },
      relations: ['user', 'offer', 'offer.user'],
    });
    if (!request) throw new NotFoundException('Request not found');

    const isGuest = request.user?.id === userId;
    const isHost  = request.offer?.user?.id === userId || request.host_id === userId;
    if (!isGuest && !isHost) throw new ForbiddenException('Not your request');

    if (isGuest) request.guest_hidden = true;
    if (isHost)  request.host_hidden  = true;

    if (request.guest_hidden && request.host_hidden) {
      await this.requestsRepo.delete(requestId);
    } else {
      await this.requestsRepo.save(request);
    }
    return { success: true };
  }

  async deleteNeed(needId: number, userId: number) {
    const need = await this.needsRepo.findOne({ where: { id: needId }, relations: ['user'] });
    if (!need) throw new NotFoundException('Need not found');
    if (need.user.id !== userId) throw new ForbiddenException('Not your need');
    await this.needsRepo.delete(needId);
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
    limit?: number;
    offset?: number;
  }) {
    const safeLimit = Math.min(filters.limit ?? 20, 50);
    const offset    = filters.offset ?? 0;

    const qb = this.offersRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.destination', 'd')
      .where('o.destination_id = :destinationId', {
        destinationId: filters.destinationId,
      })
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
      qb.andWhere('o.available_from <= :arrival', {
        arrival: filters.arrivalDate,
      });
    }
    if (filters.departureDate) {
      qb.andWhere('o.available_to >= :departure', {
        departure: filters.departureDate,
      });
    }

    const offers = await qb
      .orderBy('o.created_at', 'DESC')
      .take(safeLimit)
      .skip(offset)
      .getMany();

    // req 7.4.5 — never expose contact details in search results
    return offers.map(this.formatOffer);
  }

  // ── Guest: send request — req 7.2.7 ────────────────────────────────────────

  async createRequest(dto: CreateRequestDto, guestId: number) {
    if (new Date(dto.arrivalDate) >= new Date(dto.departureDate)) {
      throw new BadRequestException('Departure must be after arrival');
    }

    const offer = await this.offersRepo.findOne({
      where: { id: dto.offerId, is_active: true },
      relations: ['destination', 'user'],
    });
    if (!offer) throw new NotFoundException('Hosting offer not found');

    const guest = await this.usersRepo.findOneOrFail({
      where: { id: guestId },
    });

    // req 7.4.5 — guest cannot request their own offer
    if (offer.user.id === guestId) {
      throw new BadRequestException('Cannot request your own hosting offer');
    }

    // Validate request against offer conditions
    if (dto.arrivalDate < String(offer.available_from).slice(0, 10)) {
      throw new BadRequestException('Arrival date is before the offer availability');
    }
    if (dto.departureDate > String(offer.available_to).slice(0, 10)) {
      throw new BadRequestException('Departure date is after the offer availability');
    }
    if (dto.guestsCount > offer.max_guests) {
      throw new BadRequestException(`This offer allows up to ${offer.max_guests} guests`);
    }
    if (dto.withChildren && !offer.allows_children) {
      throw new BadRequestException('This offer does not allow children');
    }
    if (dto.forShabbat && !offer.allows_shabbat) {
      throw new BadRequestException('This offer does not include Shabbat hosting');
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

    // Notify the host that someone requested their offer
    const host = await this.usersRepo.findOne({ where: { id: offer.user.id } });
    if (host?.pushToken) {
      const guestName = `${guest.firstName}`.trim() || 'Someone';
      void this.notifications.sendPush(
        host.pushToken,
        '🏠 New hosting request!',
        `${guestName} wants to stay with you in ${offer.destination.city}`,
        { requestId: saved.id },
      );
    }

    return this.formatRequest(saved, guestId);
  }

  // ── Guest: my sent requests ─────────────────────────────────────────────────

  async myRequests(userId: number) {
    const requests = await this.requestsRepo.find({
      where: { user: { id: userId }, guest_hidden: false },
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
      .leftJoinAndSelect('o.user', 'offerUser')
      .where('(o.user_id = :hostId OR r.host_id = :hostId) AND r.host_hidden = false', { hostId })
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
      relations: ['offer', 'offer.user', 'user'],
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.offer?.user?.id !== hostId) {
      throw new ForbiddenException('Not your hosting offer');
    }

    request.status = status;
    const updated = await this.requestsRepo.save(request);
    this.audit.log(
      status === 'approved'
        ? 'HOSTING_REQUEST_APPROVED'
        : 'HOSTING_REQUEST_REJECTED',
      hostId,
      { requestId: requestId },
    );

    // Notify the guest about the host's decision
    const guest = await this.usersRepo.findOne({ where: { id: request.user?.id } });
    if (guest?.pushToken) {
      const title = status === 'approved' ? '🏠 Hosting request approved!' : 'Hosting request declined';
      const body  = status === 'approved'
        ? 'Your Shabbat hosting request has been approved. Check the app for details.'
        : 'Your hosting request was not approved this time.';
      void this.notifications.sendPush(guest.pushToken, title, body, { requestId });
    }

    return this.formatRequest(updated, hostId);
  }

  // ── Guest: post a hosting need ──────────────────────────────────────────────

  async createNeed(dto: CreateNeedDto, userId: number) {
    if (new Date(dto.arrivalDate) >= new Date(dto.departureDate)) {
      throw new BadRequestException('Departure must be after arrival');
    }
    const destination = await this.destinationsRepo.findOne({ where: { id: dto.destinationId } });
    if (!destination) throw new NotFoundException('Destination not found');
    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });

    const need = Object.assign(this.needsRepo.create(), {
      user,
      destination,
      arrival_date: dto.arrivalDate,
      departure_date: dto.departureDate,
      guests_count: dto.guestsCount,
      with_children: dto.withChildren ?? false,
      for_shabbat: dto.forShabbat ?? false,
      notes: dto.notes ?? null,
      is_open: true,
    });
    const saved = await this.needsRepo.save(need);
    this.audit.log('HOSTING_NEED_CREATED', userId, { needId: saved.id, destinationId: dto.destinationId });
    return this.formatNeed(saved);
  }

  // ── List open needs (all, or filtered by destination) ───────────────────────

  async listNeeds(destinationId?: number) {
    const today = new Date().toISOString().split('T')[0];
    const qb = this.needsRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.user', 'u')
      .leftJoinAndSelect('n.destination', 'd')
      .where('n.is_open = true')
      .andWhere('n.departure_date >= :today', { today });
    if (destinationId) qb.andWhere('n.destination_id = :destinationId', { destinationId });
    const needs = await qb.orderBy('n.created_at', 'DESC').take(50).getMany();
    return needs.map(this.formatNeed);
  }

  // ── My posted needs ──────────────────────────────────────────────────────────

  async myNeeds(userId: number) {
    const needs = await this.needsRepo.find({
      where: { user: { id: userId }, is_open: true },
      relations: ['destination'],
      order: { created_at: 'DESC' },
    });
    return needs.map(this.formatNeed);
  }

  // ── Close own need ───────────────────────────────────────────────────────────

  async closeNeed(needId: number, userId: number) {
    const need = await this.needsRepo.findOne({
      where: { id: needId, user: { id: userId } },
    });
    if (!need) throw new NotFoundException('Hosting need not found');
    need.is_open = false;
    await this.needsRepo.save(need);
    return { success: true };
  }

  // ── Host responds to a need → creates an approved request + notifies guest ──

  async respondToNeed(needId: number, hostId: number) {
    const need = await this.needsRepo.findOne({
      where: { id: needId, is_open: true },
      relations: ['user', 'destination'],
    });
    if (!need) throw new NotFoundException('Hosting need not found or already closed');
    if (need.user.id === hostId) throw new BadRequestException('Cannot respond to your own need');

    const destination = need.destination;

    const request = Object.assign(this.requestsRepo.create(), {
      user: need.user,
      destination,
      offer: null,
      host_id: hostId,
      arrival_date: need.arrival_date,
      departure_date: need.departure_date,
      guests_count: need.guests_count,
      with_children: need.with_children,
      for_shabbat: need.for_shabbat,
      special_requests: need.notes,
      status: 'approved' as const,
    });
    const saved = await this.requestsRepo.save(request);

    // Delete the need — it was matched, no longer relevant
    await this.needsRepo.delete(need.id);

    this.audit.log('HOSTING_NEED_RESPONDED', hostId, { needId, requestId: saved.id });

    // Notify the guest
    const guest = await this.usersRepo.findOne({ where: { id: need.user.id } });
    if (guest?.pushToken) {
      void this.notifications.sendPush(
        guest.pushToken,
        '🏠 Someone wants to host you!',
        `A host is available in ${destination.city} for your dates`,
        { requestId: saved.id },
      );
    }

    return this.formatRequest(saved, hostId);
  }

  // ── Formatters ──────────────────────────────────────────────────────────────

  private formatNeed(n: HostingNeed) {
    return {
      id: n.id,
      arrivalDate: n.arrival_date,
      departureDate: n.departure_date,
      guestsCount: n.guests_count,
      withChildren: n.with_children,
      forShabbat: n.for_shabbat,
      notes: n.notes,
      isOpen: n.is_open,
      createdAt: n.created_at,
      destination: n.destination ? { id: n.destination.id, city: n.destination.city, country: n.destination.country } : null,
      guest: n.user ? { id: n.user.id, firstName: n.user.firstName } : null,
    };
  }

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
        ? {
            id: o.destination.id,
            city: o.destination.city,
            country: o.destination.country,
          }
        : null,
      // req 7.4.5 — only first name shown in search; full contact hidden
      host: o.user ? { id: o.user.id, firstName: o.user.firstName } : null,
      isActive: o.is_active,
    };
  }

  private formatRequest(r: HostingRequest, viewerId: number) {
    const isApproved = r.status === 'approved';
    const isHost = r.offer?.user?.id === viewerId || r.host_id === viewerId;

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
