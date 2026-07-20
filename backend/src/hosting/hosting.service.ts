import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HostingOffer } from './entities/hosting-offer.entity';
import { HostingRequest } from './entities/hosting-request.entity';
import { HostingNeed } from './entities/hosting-need.entity';
import { Destination } from '../destination.entity';
import { User } from '../users/user.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateNeedDto } from './dto/create-need.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

const MAX_ACTIVE_OFFERS_PER_DESTINATION = 3;

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
    private users: UsersService,
  ) {}

  // ── Destination hosting hub summary ─────────────────────────────────────────

  async summary(destinationId: number, viewerId: number) {
    if (!Number.isFinite(destinationId)) {
      throw new BadRequestException('destinationId is required');
    }

    const blockedIds = await this.users.getBlockedUserIds(viewerId);
    const blockedFilter = blockedIds.length > 0 ? { blockedIds } : undefined;

    const activeOffersQb = this.offersRepo
      .createQueryBuilder('o')
      .leftJoin('o.user', 'u')
      .where('o.destination_id = :destinationId', { destinationId })
      .andWhere('o.is_active = true')
      .andWhere('o.available_to >= CURRENT_DATE')
      .andWhere('u.is_disabled = false');
    if (blockedFilter) activeOffersQb.andWhere('o.user_id NOT IN (:...blockedIds)', blockedFilter);

    const openNeedsQb = this.needsRepo
      .createQueryBuilder('n')
      .leftJoin('n.user', 'u')
      .where('n.destination_id = :destinationId', { destinationId })
      .andWhere('n.is_open = true')
      .andWhere('n.departure_date >= CURRENT_DATE')
      .andWhere('u.is_disabled = false');
    if (blockedFilter) openNeedsQb.andWhere('n.user_id NOT IN (:...blockedIds)', blockedFilter);

    const pendingMineQb = this.requestsRepo
      .createQueryBuilder('r')
      .leftJoin('r.offer', 'o')
      .where('r.destination_id = :destinationId', { destinationId })
      .andWhere('r.status = :status', { status: 'pending' })
      .andWhere(
        '((o.user_id = :viewerId AND r.host_hidden = false) OR (r.user_id = :viewerId AND r.offer_id IS NULL AND r.guest_hidden = false))',
        { viewerId },
      );

    const [activeOffers, openNeeds, pendingMine] = await Promise.all([
      activeOffersQb.getCount(),
      openNeedsQb.getCount(),
      pendingMineQb.getCount(),
    ]);

    return { activeOffers, openNeeds, pendingMine };
  }

  // ── Host: create offer ──────────────────────────────────────────────────────

  async createOffer(dto: CreateOfferDto, userId: number) {
    const destination = await this.destinationsRepo.findOne({
      where: { id: dto.destinationId },
    });
    if (!destination) throw new NotFoundException('Destination not found');

    const activeOffers = await this.offersRepo.find({
      where: { user: { id: userId }, destination: { id: dto.destinationId }, is_active: true },
    });

    if (activeOffers.length >= MAX_ACTIVE_OFFERS_PER_DESTINATION) {
      throw new BadRequestException(
        `You already have ${MAX_ACTIVE_OFFERS_PER_DESTINATION} active offers for this destination`,
      );
    }

    const overlapping = activeOffers.find((o) => {
      const from = String(o.available_from).slice(0, 10);
      const to = String(o.available_to).slice(0, 10);
      return from <= dto.availableTo && to >= dto.availableFrom;
    });
    if (overlapping) {
      throw new ConflictException({
        message: 'כבר יש לך הצעה לתאריכים האלה — לערוך אותה?',
        offerId: overlapping.id,
      });
    }

    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    this.requireVerifiedEmail(user);

    const offer = Object.assign(this.offersRepo.create(), {
      user,
      destination,
      hosting_type: dto.hostingType ?? 'both',
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

    void this.notifyMatchingGuests(saved, destination);

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

  // ── Host: fetch a single offer for editing ──────────────────────────────────

  async getOwnOffer(offerId: number, userId: number) {
    const offer = await this.offersRepo.findOne({
      where: { id: offerId },
      relations: ['user', 'destination'],
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.user.id !== userId) throw new ForbiddenException('Not your offer');
    return this.formatOffer(offer);
  }

  // ── Host: update offer ───────────────────────────────────────────────────────

  async updateOffer(offerId: number, dto: UpdateOfferDto, userId: number) {
    const offer = await this.offersRepo.findOne({
      where: { id: offerId },
      relations: ['user', 'destination'],
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.user.id !== userId) throw new ForbiddenException('Not your offer');

    if (dto.availableFrom !== undefined || dto.availableTo !== undefined) {
      const nextFrom = dto.availableFrom ?? String(offer.available_from).slice(0, 10);
      const nextTo = dto.availableTo ?? String(offer.available_to).slice(0, 10);

      const otherActiveOffers = await this.offersRepo.find({
        where: { user: { id: userId }, destination: { id: offer.destination.id }, is_active: true },
      });
      const overlapping = otherActiveOffers.find((o) => {
        if (o.id === offer.id) return false;
        const from = String(o.available_from).slice(0, 10);
        const to = String(o.available_to).slice(0, 10);
        return from <= nextTo && to >= nextFrom;
      });
      if (overlapping) {
        throw new ConflictException({
          message: 'כבר יש לך הצעה לתאריכים האלה — לערוך אותה?',
          offerId: overlapping.id,
        });
      }
    }

    if (dto.hostingType !== undefined) offer.hosting_type = dto.hostingType;
    if (dto.availableFrom !== undefined) offer.available_from = dto.availableFrom as unknown as Date;
    if (dto.availableTo !== undefined) offer.available_to = dto.availableTo as unknown as Date;
    if (dto.maxGuests !== undefined) offer.max_guests = dto.maxGuests;
    if (dto.allowsChildren !== undefined) offer.allows_children = dto.allowsChildren;
    if (dto.allowsShabbat !== undefined) offer.allows_shabbat = dto.allowsShabbat;
    if (dto.kashrutLevel !== undefined) offer.kashrut_level = dto.kashrutLevel || null;
    if (dto.notes !== undefined) offer.notes = dto.notes || null;

    const saved = await this.offersRepo.save(offer);
    this.audit.log('HOSTING_OFFER_UPDATED', userId, { offerId });
    return this.formatOffer(saved);
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
    viewerId: number;
    hostingType?: 'stay' | 'meals';
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
      .andWhere('o.is_active = true')
      .andWhere('o.available_to >= CURRENT_DATE')
      .andWhere('u.is_disabled = false');

    const blockedIds = await this.users.getBlockedUserIds(filters.viewerId);
    if (blockedIds.length > 0) {
      qb.andWhere('o.user_id NOT IN (:...blockedIds)', { blockedIds });
    }

    // Matching matrix: the offer "contains" the requested type (stay⊆stay|both, meals⊆meals|both)
    if (filters.hostingType) {
      qb.andWhere('o.hosting_type IN (:...types)', {
        types: [filters.hostingType, 'both'],
      });
    }

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
    this.validateStayDates(dto.arrivalDate, dto.departureDate, dto.hostingType);

    const offer = await this.offersRepo.findOne({
      where: { id: dto.offerId, is_active: true },
      relations: ['destination', 'user'],
    });
    if (!offer) throw new NotFoundException('Hosting offer not found');

    // Matching matrix — the offer must contain the requested type
    if (offer.hosting_type !== 'both' && offer.hosting_type !== dto.hostingType) {
      throw new BadRequestException('This offer does not support the requested hosting type');
    }

    const guest = await this.usersRepo.findOneOrFail({
      where: { id: guestId },
    });
    this.requireVerifiedEmail(guest);

    // req 7.4.5 — guest cannot request their own offer
    if (offer.user.id === guestId) {
      throw new BadRequestException('Cannot request your own hosting offer');
    }

    if (await this.users.isBlockedEitherWay(guestId, offer.user.id)) {
      throw new ForbiddenException('Unable to send this request');
    }

    // A guest can only have one active (pending/approved) request per offer
    const existingRequest = await this.requestsRepo.findOne({
      where: { offer: { id: offer.id }, user: { id: guestId }, status: In(['pending', 'approved']) },
    });
    if (existingRequest) {
      throw new BadRequestException(
        'כבר שלחתם בקשה להצעה הזו — היא ממתינה לתשובת המארח',
      );
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
      hosting_type: dto.hostingType,
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
      .andWhere("(r.status != 'pending' OR r.departure_date >= CURRENT_DATE)")
      .orderBy('r.created_at', 'DESC')
      .getMany();

    // req 7.4.5 — only expose guest contact when approved
    return requests.map((r) => this.formatRequest(r, hostId, requests));
  }

  // ── Host: approve / reject ──────────────────────────────────────────────────

  async updateRequestStatus(
    requestId: number,
    actorId: number,
    status: 'approved' | 'rejected',
  ) {
    const request = await this.requestsRepo.findOne({
      where: { id: requestId },
      relations: ['offer', 'offer.user', 'user'],
    });
    if (!request) throw new NotFoundException('Request not found');

    // Offer-based requests: the host decides. Need-originated requests
    // (offer=null, host_id set): the guest who posted the need decides.
    const isOfferBased = !!request.offer;
    if (request.offer) {
      if (request.offer.user.id !== actorId) {
        throw new ForbiddenException('Not your hosting offer');
      }
    } else if (request.user?.id !== actorId) {
      throw new ForbiddenException('Not your request to decide');
    }

    request.status = status;
    const updated = await this.requestsRepo.save(request);
    this.audit.log(
      status === 'approved'
        ? 'HOSTING_REQUEST_APPROVED'
        : 'HOSTING_REQUEST_REJECTED',
      actorId,
      { requestId: requestId },
    );

    if (isOfferBased) {
      // Notify the guest about the host's decision
      const guest = await this.usersRepo.findOne({ where: { id: request.user?.id } });
      if (guest?.pushToken) {
        const title = status === 'approved' ? '🏠 Hosting request approved!' : 'Hosting request declined';
        const body  = status === 'approved'
          ? 'Your Shabbat hosting request has been approved. Check the app for details.'
          : 'Your hosting request was not approved this time.';
        void this.notifications.sendPush(guest.pushToken, title, body, { requestId });
      }
    } else {
      // Notify the host about the guest's decision
      if (request.host_id) {
        const host = await this.usersRepo.findOne({ where: { id: request.host_id } });
        if (host?.pushToken) {
          const title = status === 'approved' ? '🏠 Your hosting offer was approved!' : 'Hosting offer declined';
          const body  = status === 'approved'
            ? 'The guest approved your offer to host them. Check the app for details.'
            : 'The guest chose a different host for this stay.';
          void this.notifications.sendPush(host.pushToken, title, body, { requestId });
        }
      }

      // Guest approved one host's offer on their need — close the need and
      // auto-reject every other pending offer on it.
      if (status === 'approved' && request.need_id) {
        await this.needsRepo.update({ id: request.need_id }, { is_open: false });

        const siblings = await this.requestsRepo.find({
          where: { need_id: request.need_id, status: 'pending' },
        });
        for (const sibling of siblings) {
          if (sibling.id === request.id) continue;
          sibling.status = 'rejected';
          await this.requestsRepo.save(sibling);
          this.audit.log('HOSTING_REQUEST_REJECTED', actorId, {
            requestId: sibling.id,
            reason: 'need_matched_elsewhere',
          });
          if (sibling.host_id) {
            const rejectedHost = await this.usersRepo.findOne({ where: { id: sibling.host_id } });
            if (rejectedHost?.pushToken) {
              void this.notifications.sendPush(
                rejectedHost.pushToken,
                'Hosting offer declined',
                'The guest chose a different host for this stay.',
                { requestId: sibling.id },
              );
            }
          }
        }
      }
    }

    return this.formatRequest(updated, actorId);
  }

  // ── Guest: post a hosting need ──────────────────────────────────────────────

  async createNeed(dto: CreateNeedDto, userId: number) {
    const hostingType = dto.hostingType ?? 'stay';
    this.validateStayDates(dto.arrivalDate, dto.departureDate, hostingType);
    const destination = await this.destinationsRepo.findOne({ where: { id: dto.destinationId } });
    if (!destination) throw new NotFoundException('Destination not found');
    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    this.requireVerifiedEmail(user);

    const need = Object.assign(this.needsRepo.create(), {
      user,
      destination,
      hosting_type: hostingType,
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

    void this.notifyMatchingHosts(saved, destination);

    return this.formatNeed(saved);
  }

  // ── List open needs (all, or filtered by destination) ───────────────────────

  async listNeeds(destinationId: number | undefined, viewerId: number) {
    const today = new Date().toISOString().split('T')[0];
    const qb = this.needsRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.user', 'u')
      .leftJoinAndSelect('n.destination', 'd')
      .where('n.is_open = true')
      .andWhere('n.departure_date >= :today', { today })
      .andWhere('u.is_disabled = false');
    if (destinationId) qb.andWhere('n.destination_id = :destinationId', { destinationId });

    const blockedIds = await this.users.getBlockedUserIds(viewerId);
    if (blockedIds.length > 0) {
      qb.andWhere('n.user_id NOT IN (:...blockedIds)', { blockedIds });
    }

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

    const host = await this.usersRepo.findOneOrFail({ where: { id: hostId } });
    this.requireVerifiedEmail(host);

    if (await this.users.isBlockedEitherWay(hostId, need.user.id)) {
      throw new ForbiddenException('Unable to respond to this need');
    }

    // A host may only have one active (pending/approved) response per need
    const existing = await this.requestsRepo.findOne({
      where: { need_id: needId, host_id: hostId, status: In(['pending', 'approved']) },
    });
    if (existing) throw new BadRequestException('You already responded to this need');

    const destination = need.destination;

    const request = Object.assign(this.requestsRepo.create(), {
      user: need.user,
      destination,
      offer: null,
      host_id: hostId,
      need_id: need.id,
      hosting_type: need.hosting_type,
      arrival_date: need.arrival_date,
      departure_date: need.departure_date,
      guests_count: need.guests_count,
      with_children: need.with_children,
      for_shabbat: need.for_shabbat,
      special_requests: need.notes,
      status: 'pending' as const,
    });
    const saved = await this.requestsRepo.save(request);

    // Need stays open until the guest approves one of the (possibly several) offers
    this.audit.log('HOSTING_NEED_RESPONDED', hostId, { needId, requestId: saved.id });

    // Notify the guest — they must approve or decline
    const guest = await this.usersRepo.findOne({ where: { id: need.user.id } });
    if (guest?.pushToken) {
      void this.notifications.sendPush(
        guest.pushToken,
        '🏠 A host offered to host you!',
        `Review the offer for ${destination.city} and approve or decline in the app`,
        { requestId: saved.id },
      );
    }

    return this.formatRequest(saved, hostId);
  }

  // ── Match pushes — fire-and-forget, exact intersection only ─────────────────
  // A given need↔offer pair can only ever be evaluated by whichever of the two
  // is created later (the earlier one already existed when we query "current
  // matches"), so a pair is naturally notified at most once — no dedup table needed.

  private async notifyMatchingHosts(need: HostingNeed, destination: Destination) {
    try {
      const matchingOffers = await this.offersRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.user', 'u')
        .where('o.destination_id = :destinationId', { destinationId: destination.id })
        .andWhere('o.is_active = true')
        .andWhere('o.available_to >= CURRENT_DATE')
        .andWhere('o.available_from <= :arrival', { arrival: need.arrival_date })
        .andWhere('o.available_to >= :departure', { departure: need.departure_date })
        .andWhere('o.hosting_type IN (:...types)', { types: [need.hosting_type, 'both'] })
        .getMany();

      for (const offer of matchingOffers) {
        if (offer.user?.pushToken) {
          void this.notifications.sendPush(
            offer.user.pushToken,
            '🏠 A guest is looking for hosting!',
            `Someone needs ${need.hosting_type === 'meals' ? 'a Shabbat meal' : 'a place to stay'} in ${destination.city} for your dates`,
            { needId: need.id, destinationId: destination.id },
          );
        }
      }
    } catch {
      // Best-effort — a failed match query must never affect the need creation response
    }
  }

  private async notifyMatchingGuests(offer: HostingOffer, destination: Destination) {
    try {
      const from = String(offer.available_from).slice(0, 10);
      const to = String(offer.available_to).slice(0, 10);
      const types = offer.hosting_type === 'both' ? ['stay', 'meals'] : [offer.hosting_type];

      const matchingNeeds = await this.needsRepo
        .createQueryBuilder('n')
        .leftJoinAndSelect('n.user', 'u')
        .where('n.destination_id = :destinationId', { destinationId: destination.id })
        .andWhere('n.is_open = true')
        .andWhere('n.departure_date >= CURRENT_DATE')
        .andWhere('n.arrival_date >= :from', { from })
        .andWhere('n.departure_date <= :to', { to })
        .andWhere('n.hosting_type IN (:...types)', { types })
        .getMany();

      for (const need of matchingNeeds) {
        if (need.user?.pushToken) {
          void this.notifications.sendPush(
            need.user.pushToken,
            '🏠 A host is available for your dates!',
            `A new hosting offer matches your ${need.hosting_type === 'meals' ? 'Shabbat meal' : 'stay'} request in ${destination.city}`,
            { offerId: offer.id, destinationId: destination.id },
          );
        }
      }
    } catch (err) {
      // Best-effort — a failed match query must never affect the offer creation response
    }
  }

  // req 12 — a verified email is a precondition for publishing/acting in hosting
  private requireVerifiedEmail(user: User) {
    if (!user.isActive) {
      throw new ForbiddenException('Please verify your email before using hosting features');
    }
  }

  // Meals-only bookings are for a single Shabbat date (arrival = departure);
  // the usual "departure after arrival" rule is waived for that case.
  private validateStayDates(arrivalDate: string, departureDate: string, hostingType: 'stay' | 'meals') {
    if (hostingType === 'meals') {
      if (new Date(arrivalDate) > new Date(departureDate)) {
        throw new BadRequestException('Departure must not be before arrival');
      }
    } else if (new Date(arrivalDate) >= new Date(departureDate)) {
      throw new BadRequestException('Departure must be after arrival');
    }
  }

  // ── Formatters ──────────────────────────────────────────────────────────────

  private formatNeed(n: HostingNeed) {
    return {
      id: n.id,
      hostingType: n.hosting_type,
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
      hostingType: o.hosting_type,
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

  private formatRequest(r: HostingRequest, viewerId: number, siblings?: HostingRequest[]) {
    const isApproved = r.status === 'approved';
    const isHost = r.offer?.user?.id === viewerId || r.host_id === viewerId;

    // Soft warning (not a block) — another request on the same offer is
    // already approved with overlapping dates. Two families hosted at once
    // can be legitimate if the host is aware, so we only flag it.
    let overlapWarning: { guestName: string; arrivalDate: string; departureDate: string } | null = null;
    if (siblings && r.status === 'pending' && r.offer) {
      const conflict = siblings.find((other) =>
        other.id !== r.id &&
        other.status === 'approved' &&
        other.offer?.id === r.offer!.id &&
        other.arrival_date <= r.departure_date &&
        other.departure_date >= r.arrival_date,
      );
      if (conflict) {
        overlapWarning = {
          guestName: conflict.user?.firstName ?? 'Guest',
          arrivalDate: conflict.arrival_date,
          departureDate: conflict.departure_date,
        };
      }
    }

    return {
      id: r.id,
      status: r.status,
      hostingType: r.hosting_type,
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
      overlapWarning,
    };
  }
}
