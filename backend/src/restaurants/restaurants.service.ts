import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from '../restaurant.entity';

export interface RestaurantFilters {
  type?: string;
  kashrut?: string;
  q?: string;
  lat?: number;
  lng?: number;
}

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private restaurantsRepo: Repository<Restaurant>,
  ) {}

  // req 4.1 — list restaurants with optional filters + distance
  async findByDestination(destinationId: number, filters: RestaurantFilters = {}): Promise<Restaurant[]> {
    const { type, kashrut, q, lat, lng } = filters;

    // With distance: use raw SQL so PostGIS can compute ST_Distance
    if (lat !== undefined && lng !== undefined) {
      let sql = `
        SELECT
          r.id,
          r.name,
          r.restaurant_type   AS "restaurantType",
          r.kashrut_level     AS "kashrutLevel",
          r.address,
          r.opening_hours     AS "openingHours",
          r.created_at        AS "createdAt",
          ROUND(
            ST_Distance(
              r.location::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            )::numeric
          ) AS "distanceMeters"
        FROM restaurants r
        WHERE r.destination_id = $3
      `;
      const params: (string | number)[] = [lng, lat, destinationId];
      let idx = 4;

      if (type)   { sql += ` AND r.restaurant_type = $${idx}`; params.push(type);       idx++; }
      if (kashrut){ sql += ` AND r.kashrut_level   = $${idx}`; params.push(kashrut);    idx++; }
      if (q)      { sql += ` AND r.name ILIKE $${idx}`;        params.push(`%${q}%`);   idx++; }

      sql += ' ORDER BY "distanceMeters" ASC';
      return this.restaurantsRepo.query(sql, params);
    }

    // Without distance: use find() with where object
    const where: any = { destination: { id: destinationId } };
    if (type)    where.restaurantType = type;
    if (kashrut) where.kashrutLevel   = kashrut;

    let results = await this.restaurantsRepo.find({
      where,
      select: { id: true, name: true, restaurantType: true, kashrutLevel: true, address: true, openingHours: true, createdAt: true },
      order: { name: 'ASC' },
    });

    if (q) {
      const lq = q.toLowerCase();
      results = results.filter((r) => r.name.toLowerCase().includes(lq));
    }

    return results;
  }

  // req 4.4 — single restaurant details
  async findOne(id: number) {
    const restaurant = await this.restaurantsRepo
      .createQueryBuilder('r')
      .select([
        'r.id', 'r.name', 'r.restaurantType', 'r.kashrutLevel',
        'r.address', 'r.openingHours', 'r.createdAt',
      ])
      .leftJoinAndSelect('r.destination', 'destination')
      .where('r.id = :id', { id })
      .getOne();

    if (!restaurant) throw new NotFoundException(`Restaurant #${id} not found`);
    return restaurant;
  }
}
