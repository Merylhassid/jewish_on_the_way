import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserFavorite } from './user-favorite.entity';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';
import { EntityType } from '../common/enums/entity-type.enum';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(UserFavorite) private favRepo: Repository<UserFavorite>,
    @InjectRepository(Restaurant)   private restRepo: Repository<Restaurant>,
    @InjectRepository(Synagogue)    private synRepo:  Repository<Synagogue>,
  ) {}

  async toggle(userId: number, entityType: EntityType, entityId: number) {
    const existing = await this.favRepo.findOne({
      where: { userId, entityType, entityId },
    });
    if (existing) {
      await this.favRepo.remove(existing);
      return { saved: false };
    }
    await this.favRepo.save(this.favRepo.create({ userId, entityType, entityId }));
    return { saved: true };
  }

  async isSaved(userId: number, entityType: EntityType, entityId: number) {
    const count = await this.favRepo.count({
      where: { userId, entityType, entityId },
    });
    return { saved: count > 0 };
  }

  async getAll(userId: number) {
    const favs = await this.favRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const restIds = favs.filter(f => f.entityType === EntityType.RESTAURANT).map(f => f.entityId);
    const synIds  = favs.filter(f => f.entityType === EntityType.SYNAGOGUE).map(f => f.entityId);

    const [restaurants, synagogues] = await Promise.all([
      restIds.length ? this.restRepo.find({ where: { id: In(restIds) }, relations: ['destination'] }) : [],
      synIds.length  ? this.synRepo.find({ where: { id: In(synIds) } }) : [],
    ]);

    return {
      restaurants: restaurants.map(r => ({
        id: r.id, name: r.name, address: r.address,
        kashrutLevel: r.kashrutLevel, restaurantType: r.restaurantType,
        destination: r.destination ? { id: r.destination.id, city: r.destination.city } : null,
      })),
      synagogues: synagogues.map(s => ({
        id: s.id, name: s.name, address: s.address, denomination: s.denomination,
      })),
    };
  }
}
