import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Repository } from 'typeorm';
import { Destination } from '../destination.entity';

@Injectable()
export class DestinationsService {
  constructor(
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
  ) {}

  // req 3.1 — full list or child destinations when parentId is provided
  async findAll(parentId?: number) {
    const where = parentId === undefined
      ? { parent: IsNull() }
      : { parent: { id: parentId } };

    const destinations = await this.destinationsRepo.find({
      where,
      relations: ['children'],
      select: ['id', 'name', 'city', 'country', 'countryCode', 'createdAt', 'description'],
      order: { name: 'ASC' },
    });

    return destinations.map((destination) => ({
      ...destination,
      hasChildren: destination.children?.length > 0,
    }));
  }

  // req 3.2 + 3.2.1 — case-insensitive search by name
  async search(q: string, parentId?: number) {
    const where = parentId === undefined
      ? { name: ILike(`%${q}%`) }
      : { name: ILike(`%${q}%`), parent: { id: parentId } };

    const destinations = await this.destinationsRepo.find({
      where,
      relations: ['children'],
      select: ['id', 'name', 'city', 'country', 'countryCode', 'createdAt', 'description'],
      order: { name: 'ASC' },
    });

    return destinations.map((destination) => ({
      ...destination,
      hasChildren: destination.children?.length > 0,
    }));
  }

  // req 3.3 — single destination detail
  async findOne(id: number) {
    const destination = await this.destinationsRepo.findOne({
      where: { id },
      relations: ['parent'],
      select: ['id', 'name', 'city', 'country', 'countryCode', 'description', 'createdAt'],
    });

    if (!destination) {
      throw new NotFoundException(`Destination #${id} not found`);
    }

    return destination;
  }
}
