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
   * Returns basic fields: id, name, address, description, phone, website, location
   */
  // מיפוי denomination (מהמודל) → ערכי DB אפשריים
  private readonly DENOM_MAP: Record<string, string[]> = {
    ashkenaz:  ['אשכנז', 'אשכנזי', 'ליטאי', 'Ashkenazi', 'Orthodox'],
    sfarad:    ['ספרדי', 'ספרד', 'עדות המזרח', 'מרוקאי', 'הודי', 'בוכרה', 'אתיופי'],
    chabad:    ['חב"ד', 'חסידי', 'Chabad'],
    teimanim:  ['תימני', 'תימן', 'שאמי', 'בלאדי', 'ירושלמי'],
  };

  async findByDestination(
    destinationId: number,
    denomination?: string,
    offset = 0,
    lat?: number,
    lng?: number,
  ): Promise<{ data: any[]; total: number }> {
    const denomValues = denomination ? (this.DENOM_MAP[denomination] ?? []) : [];

    // ── GPS mode: raw SQL with distance ordering ─────────
    if (lat !== undefined && lng !== undefined) {
      // Build WHERE + params separately (count query doesn't need lat/lng)
      const countParams: any[] = [destinationId];
      let countWhere = `s."destinationId" = $1`;
      const gpsParams: any[] = [lng, lat, destinationId];
      let gpsWhere = `s."destinationId" = $3`;
      let cIdx = 2;
      let gIdx = 4;

      if (denomValues.length > 0) {
        countWhere += ` AND s.denomination = ANY($${cIdx++})`;
        countParams.push(denomValues);
        gpsWhere  += ` AND s.denomination = ANY($${gIdx++})`;
        gpsParams.push(denomValues);
      }

      const countResult = await this.synagoguesRepo.query(
        `SELECT COUNT(*) FROM synagogues s WHERE ${countWhere}`,
        countParams,
      );
      const total = parseInt(countResult[0].count, 10);

      gpsParams.push(offset);
      const data = await this.synagoguesRepo.query(
        `SELECT s.id, s.name, s.address, s.description, s.phone, s.website, s.denomination, s.location,
                ROUND(ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric) AS "distanceMeters"
         FROM synagogues s
         WHERE ${gpsWhere}
         ORDER BY s.location::geography <-> ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
         LIMIT 50 OFFSET $${gIdx}`,
        gpsParams,
      );
      return { data, total };
    }

    // ── No GPS: findAndCount sorted by name ──────────────
    const { In } = await import('typeorm');
    const where: any = { destination: { id: destinationId } };
    if (denomValues.length > 0) where.denomination = In(denomValues);

    const [data, total] = await this.synagoguesRepo.findAndCount({
      where,
      select: ['id', 'name', 'address', 'description', 'phone', 'website', 'location', 'denomination'],
      order: { name: 'ASC' },
      take: 50,
      skip: offset,
    });
    return { data, total };
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

  async findNearby(lat: number, lng: number, limit = 10): Promise<any[]> {
    const sql = `
      SELECT
        s.id, s.name, s.address, s.denomination, s.phone,
        ST_Y(s.location::geometry) AS lat,
        ST_X(s.location::geometry) AS lng,
        ROUND(ST_Distance(
          s.location::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        )::numeric) AS "distanceMeters"
      FROM synagogues s
      WHERE s.location IS NOT NULL
      ORDER BY s.location::geography <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      LIMIT $3
    `;
    return this.synagoguesRepo.query(sql, [lat, lng, limit]);
  }
}
