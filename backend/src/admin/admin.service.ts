import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from '../destination.entity';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';
import { CandidateSynagogue } from '../candidate-synagogue.entity';
import { User } from '../users/user.entity';
import { ChatMessage } from '../chat/chat-message.entity';
import { PlacesService } from '../places/places.service';
import { CandidateMapperService } from '../places/candidate-mapper';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
    @InjectRepository(Restaurant)
    private restaurantsRepo: Repository<Restaurant>,
    @InjectRepository(Synagogue)
    private synagoguesRepo: Repository<Synagogue>,
    @InjectRepository(CandidateSynagogue)
    private candidateSynagoguesRepo: Repository<CandidateSynagogue>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(ChatMessage)
    private messagesRepo: Repository<ChatMessage>,
    private placesService: PlacesService,
    private candidateMapper: CandidateMapperService,
  ) {}

  async createDestination(dto: CreateDestinationDto) {
    let parent: Destination | undefined | null;
    if (dto.parentId) {
      parent = await this.destinationsRepo.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent destination #${dto.parentId} not found`,
        );
      }
    }

    const destination = this.destinationsRepo.create({
      name: dto.name,
      city: dto.city,
      country: dto.country,
      countryCode: dto.countryCode.toUpperCase(),
      description: dto.description,
      location: { type: 'Point', coordinates: [dto.lng, dto.lat] },
      parent: parent ?? undefined,
    });
    return this.destinationsRepo.save(destination);
  }

  async deleteDestination(id: number) {
    const destination = await this.destinationsRepo.findOne({ where: { id } });
    if (!destination)
      throw new NotFoundException(`Destination #${id} not found`);
    await this.destinationsRepo.remove(destination);
    return { message: `Destination #${id} deleted` };
  }

  async createRestaurant(dto: CreateRestaurantDto) {
    const destination = await this.destinationsRepo.findOne({
      where: { id: dto.destinationId },
    });
    if (!destination) {
      throw new NotFoundException(
        `Destination #${dto.destinationId} not found`,
      );
    }

    const restaurant = this.restaurantsRepo.create({
      name: dto.name,
      restaurantType: dto.restaurantType,
      kashrutLevel: dto.kashrutLevel,
      address: dto.address,
      openingHours: dto.openingHours,
      location: { type: 'Point', coordinates: [dto.lng, dto.lat] },
      destination,
    });
    return this.restaurantsRepo.save(restaurant);
  }

  async deleteRestaurant(id: number) {
    const restaurant = await this.restaurantsRepo.findOne({ where: { id } });
    if (!restaurant) throw new NotFoundException(`Restaurant #${id} not found`);
    await this.restaurantsRepo.remove(restaurant);
    return { message: `Restaurant #${id} deleted` };
  }

  // req 9.4.1 — block (deactivate) a user account
  async blockUser(id: number) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    if (!user.isActive) return { message: `User #${id} is already blocked` };

    await this.usersRepo.update({ id }, { isActive: false });
    return { message: `User #${id} has been blocked` };
  }

  // req 9.4.1 — delete an abusive chat message
  async deleteMessage(id: number) {
    const message = await this.messagesRepo.findOne({ where: { id } });
    if (!message) throw new NotFoundException(`Message #${id} not found`);
    await this.messagesRepo.remove(message);
    return { message: `Message #${id} deleted` };
  }

  async deleteSynagogue(id: number) {
    const synagogue = await this.synagoguesRepo.findOne({ where: { id } });
    if (!synagogue) throw new NotFoundException(`Synagogue #${id} not found`);
    await this.synagoguesRepo.remove(synagogue);
    return { message: `Synagogue #${id} deleted` };
  }

  // Fetch real places from Google Places API for a destination
  async syncDestination(id: number) {
    const destination = await this.destinationsRepo.findOne({ where: { id } });
    if (!destination)
      throw new NotFoundException(`Destination #${id} not found`);

    const result = await this.placesService.syncDestination(destination);
    return {
      message: `Sync complete for ${destination.city}`,
      newRestaurants: result.restaurants,
      newSynagogues: result.synagogues,
      newChabadHouses: result.chabad,
    };
  }

  // --- Candidate Synagogues ---

  /**
   * List candidate synagogues for a destination, optionally filtered by status.
   */
  async listCandidateSynagogues(
    destinationId: number,
    status?: 'pending' | 'approved' | 'rejected',
  ) {
    const destination = await this.destinationsRepo.findOne({
      where: { id: destinationId },
    });
    if (!destination) {
      throw new NotFoundException(`Destination #${destinationId} not found`);
    }

    const query = this.candidateSynagoguesRepo
      .createQueryBuilder('cs')
      .where('cs.destination_id = :destId', { destId: destinationId })
      .orderBy('cs.status', 'ASC')
      .addOrderBy('cs.created_at', 'DESC');

    if (status) {
      query.andWhere('cs.status = :status', { status });
    }

    return query.getMany();
  }

  /**
   * Approve a candidate synagogue: maps it to Synagogue and creates/updates record.
   */
  async approveCandidateSynagogue(candidateId: number) {
    const candidate = await this.candidateSynagoguesRepo.findOne({
      where: { id: candidateId },
      relations: ['destination'],
    });
    if (!candidate) {
      throw new NotFoundException(
        `Candidate Synagogue #${candidateId} not found`,
      );
    }

    if (candidate.status !== 'pending') {
      return {
        message: `Candidate #${candidateId} is already ${candidate.status}`,
        candidate,
      };
    }

    try {
      // Map candidate to Synagogue using the merge logic
      const { synagogue, isNew } =
        await this.candidateMapper.mapCandidateToSynagogue(candidate);

      // Save Synagogue
      const savedSynagogue = await this.synagoguesRepo.save(synagogue);

      // Update candidate status to approved
      candidate.status = 'approved';
      candidate.approvedAt = new Date();
      await this.candidateSynagoguesRepo.save(candidate);

      return {
        message: `Candidate #${candidateId} approved (${isNew ? 'created' : 'updated'} Synagogue #${savedSynagogue.id})`,
        candidate,
        synagogue: savedSynagogue,
        isNew,
      };
    } catch (error) {
      throw new Error(
        `Failed to approve candidate #${candidateId}: ${error.message}`,
      );
    }
  }

  /**
   * Reject a candidate synagogue.
   */
  async rejectCandidateSynagogue(candidateId: number, reason?: string) {
    const candidate = await this.candidateSynagoguesRepo.findOne({
      where: { id: candidateId },
    });
    if (!candidate) {
      throw new NotFoundException(
        `Candidate Synagogue #${candidateId} not found`,
      );
    }

    if (candidate.status !== 'pending') {
      return {
        message: `Candidate #${candidateId} is already ${candidate.status}`,
        candidate,
      };
    }

    candidate.status = 'rejected';
    candidate.rejectedAt = new Date();
    candidate.rejectionReason = reason || null;
    await this.candidateSynagoguesRepo.save(candidate);

    return {
      message: `Candidate #${candidateId} rejected`,
      candidate,
    };
  }
}
