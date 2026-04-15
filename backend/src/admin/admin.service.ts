import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from '../destination.entity';
import { Restaurant } from '../restaurant.entity';
import { User } from '../users/user.entity';
import { ChatMessage } from '../chat/chat-message.entity';
import { PlacesService } from '../places/places.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
    @InjectRepository(Restaurant)
    private restaurantsRepo: Repository<Restaurant>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(ChatMessage)
    private messagesRepo: Repository<ChatMessage>,
    private placesService: PlacesService,
  ) {}

  async createDestination(dto: CreateDestinationDto) {
    let parent: Destination | undefined | null;
    if (dto.parentId) {
      parent = await this.destinationsRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException(`Parent destination #${dto.parentId} not found`);
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
    if (!destination) throw new NotFoundException(`Destination #${id} not found`);
    await this.destinationsRepo.remove(destination);
    return { message: `Destination #${id} deleted` };
  }

  async createRestaurant(dto: CreateRestaurantDto) {
    const destination = await this.destinationsRepo.findOne({
      where: { id: dto.destinationId },
    });
    if (!destination) {
      throw new NotFoundException(`Destination #${dto.destinationId} not found`);
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

  // Fetch real places from Google Places API for a single destination
  async syncDestination(id: number) {
    const destination = await this.destinationsRepo.findOne({ where: { id } });
    if (!destination) throw new NotFoundException(`Destination #${id} not found`);

    const result = await this.placesService.syncDestination(destination);
    return {
      message: `Sync complete for ${destination.city}`,
      newRestaurants: result.restaurants,
      newSynagogues: result.synagogues,
      newChabadHouses: result.chabad,
    };
  }

  // --- Kosher validation system (req 8-point spec) ---

  // Returns all destination IDs that currently have restaurant data in the DB
  async getDestinationsWithRestaurants() {
    return this.placesService.getDestinationIdsWithRestaurants();
  }

  // req 7 — audit specific destinations (scan + log, no writes)
  async auditDestinations(destinationIds: number[]) {
    return this.placesService.auditDestinations(destinationIds);
  }

  // req 7 — cleanup non-kosher restaurants in specific destinations (dry-run or delete)
  async cleanupDestinations(destinationIds: number[], confirm: boolean) {
    return this.placesService.cleanupDestinations(destinationIds, confirm);
  }

  // req 7 — revalidate & reclassify restaurants in specific destinations
  async revalidateDestinations(destinationIds: number[]) {
    return this.placesService.revalidateDestinations(destinationIds);
  }

  // req 7 — re-sync (fetch from Google) for specific destinations only
  async resyncDestinations(destinationIds: number[]) {
    return this.placesService.syncSpecificDestinations(destinationIds);
  }

  // Fetch real places from Google Places API for ALL cities (skip country-level parents)
  async syncAllDestinations() {
    const destinations = await this.destinationsRepo.find();
    // Only sync leaf cities (those that have a parent OR have no children = real cities)
    const cities = destinations.filter(
      (d) => d.parentId !== undefined && d.parentId !== null,
    );

    const results: { city: string; restaurants: number; error?: string }[] = [];
    let totalRestaurants = 0;

    for (const destination of cities) {
      try {
        const result = await this.placesService.syncDestination(destination);
        results.push({ city: destination.city, restaurants: result.restaurants });
        totalRestaurants += result.restaurants;
      } catch (err: any) {
        results.push({ city: destination.city, restaurants: 0, error: err.message });
      }
    }

    return {
      message: `Sync complete — ${totalRestaurants} restaurants imported across ${cities.length} cities`,
      results,
    };
  }
}
