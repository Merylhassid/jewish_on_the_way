import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Synagogue } from '../synagogue.entity';

@Injectable()
export class SynagoguesService {
  constructor(
    @InjectRepository(Synagogue)
    private synagoguesRepo: Repository<Synagogue>,
  ) {}

  /**
   * Find all synagogues by destination ID
   * Returns basic fields: id, name, address, phone, website, location
   */
  async findByDestination(destinationId: number) {
    const synagogues = await this.synagoguesRepo.find({
      where: {
        destination: { id: destinationId },
      },
      select: [
        'id',
        'name',
        'address',
        'phone',
        'website',
        'location',
      ],
      order: {
        name: 'ASC',
      },
    });

    return synagogues;
  }

  /**
   * Find a single synagogue by ID
   * Returns full details including denomination, opening hours, etc.
   */
  async findOne(id: number) {
    const synagogue = await this.synagoguesRepo.findOne({
      where: { id },
      relations: ['destination'],
    });

    return synagogue;
  }
}
