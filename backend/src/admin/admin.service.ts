import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from '../destination.entity';
import { Restaurant } from '../restaurant.entity';
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
    private placesService: PlacesService,
  ) {}

  async createDestination(dto: CreateDestinationDto) {
    const destination = this.destinationsRepo.create({
      name: dto.name,
      city: dto.city,
      country: dto.country,
      countryCode: dto.countryCode.toUpperCase(),
      description: dto.description,
      location: { type: 'Point', coordinates: [dto.lng, dto.lat] },
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

  // Fetch real places from Google Places API for a destination
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
}
