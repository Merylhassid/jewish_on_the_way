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
  // When lat/lng are supplied, adds distanceMeters and sorts nearest-first
  async findAll(parentId?: number, lat?: number, lng?: number) {
    if (lat !== undefined && lng !== undefined) {
      const params: (number | string)[] = [lng, lat];
      let parentFilter: string;
      if (parentId === undefined) {
        parentFilter = 'd.parent_id IS NULL';
      } else {
        params.push(parentId);
        parentFilter = `d.parent_id = $${params.length}`;
      }
      return this.destinationsRepo.query(
        `SELECT
           d.id, d.name, d.city, d.country,
           d.country_code      AS "countryCode",
           d.description,
           EXISTS(SELECT 1 FROM destinations c WHERE c.parent_id = d.id) AS "hasChildren",
           ROUND(
             ST_Distance(
               d.location::geography,
               ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
             )::numeric
           ) AS "distanceMeters"
         FROM destinations d
         WHERE ${parentFilter}
         ORDER BY "distanceMeters" ASC`,
        params,
      );
    }

    const where =
      parentId === undefined
        ? { parent: IsNull() }
        : { parent: { id: parentId } };

    const destinations = await this.destinationsRepo.find({
      where,
      relations: ['children'],
      select: ['id', 'name', 'city', 'country', 'countryCode', 'createdAt', 'description'],
      order: { name: 'ASC' },
    });

    return destinations.map((d) => ({ ...d, hasChildren: d.children?.length > 0 }));
  }

  // req 3.2 + 3.2.1 — case-insensitive search by name
  async search(q: string, parentId?: number, lat?: number, lng?: number) {
    if (lat !== undefined && lng !== undefined) {
      const params: (number | string)[] = [lng, lat, `%${q}%`];
      let parentFilter: string;
      if (parentId === undefined) {
        parentFilter = 'd.parent_id IS NULL';
      } else {
        params.push(parentId);
        parentFilter = `d.parent_id = $${params.length}`;
      }
      return this.destinationsRepo.query(
        `SELECT
           d.id, d.name, d.name_he AS "nameHe", d.city, d.country,
           d.country_code      AS "countryCode",
           d.description,
           EXISTS(SELECT 1 FROM destinations c WHERE c.parent_id = d.id) AS "hasChildren",
           ROUND(
             ST_Distance(
               d.location::geography,
               ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
             )::numeric
           ) AS "distanceMeters"
         FROM destinations d
         WHERE ${parentFilter} AND (d.name ILIKE $3 OR d.name_he ILIKE $3)
         ORDER BY "distanceMeters" ASC`,
        params,
      );
    }

    const where =
      parentId === undefined
        ? [{ name: ILike(`%${q}%`) }, { nameHe: ILike(`%${q}%`) }]
        : [{ name: ILike(`%${q}%`), parent: { id: parentId } }, { nameHe: ILike(`%${q}%`), parent: { id: parentId } }];

    const destinations = await this.destinationsRepo.find({
      where,
      relations: ['children'],
      select: ['id', 'name', 'nameHe', 'city', 'country', 'countryCode', 'createdAt', 'description'],
      order: { name: 'ASC' },
    });

    return destinations.map((d) => ({ ...d, hasChildren: d.children?.length > 0 }));
  }

  // req 3.3 — single destination detail (includes lat/lng for map)
  async findOne(id: number) {
    const rows = await this.destinationsRepo.query(
      `SELECT d.id, d.name, d.city, d.country,
        d.country_code AS "countryCode", d.description,
        ST_Y(d.location::geometry) AS lat,
        ST_X(d.location::geometry) AS lng
       FROM destinations d WHERE d.id = $1`,
      [id],
    );

    if (!rows.length) {
      throw new NotFoundException(`Destination #${id} not found`);
    }

    return rows[0];
  }
}
