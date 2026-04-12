import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Destination } from '../destination.entity';

@Injectable()
export class DestinationsService {
  constructor(
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
  ) {}

  // req 3.1 — full list
  findAll() {
    return this.destinationsRepo.find({
      select: ['id', 'name', 'city', 'country', 'countryCode', 'createdAt'],
      order: { name: 'ASC' },
    });
  }

  // req 3.2 + 3.2.1 — case-insensitive search by name
  search(q: string) {
    return this.destinationsRepo.find({
      where: { name: ILike(`%${q}%`) },
      select: ['id', 'name', 'city', 'country', 'countryCode', 'createdAt'],
      order: { name: 'ASC' },
    });
  }

  // req 3.3 — single destination detail
  async findOne(id: number) {
    const destination = await this.destinationsRepo.findOne({
      where: { id },
      select: ['id', 'name', 'city', 'country', 'countryCode', 'description', 'createdAt'],
    });

    if (!destination) {
      throw new NotFoundException(`Destination #${id} not found`);
    }

    return destination;
  }
}
