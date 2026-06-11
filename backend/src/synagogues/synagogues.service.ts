import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Synagogue } from '../synagogue.entity';
import { Destination } from '../destination.entity';

@Injectable()
export class SynagoguesService {
  constructor(
    @InjectRepository(Synagogue)
    private synagoguesRepo: Repository<Synagogue>,
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
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
    expandNearby = false,
  ): Promise<{ data: any[]; total: number; denominationFallback?: boolean }> {
    const denomValues = denomination ? (this.DENOM_MAP[denomination] ?? []) : [];
    const origin = await this.resolveSearchOrigin(destinationId, lat, lng, expandNearby);
    const searchLat = origin?.lat;
    const searchLng = origin?.lng;

    // ── GPS mode: raw SQL with distance ordering ─────────
    if (searchLat !== undefined && searchLng !== undefined) {
      const countParams: any[] = [destinationId];
      let countWhere = `s."destinationId" = $1`;
      const gpsParams: any[] = [searchLng, searchLat, destinationId];
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
      let total = parseInt(countResult[0].count, 10);
      let denominationFallback = false;

      // Fallback: if denomination filter returned nothing, retry without denomination
      if (total === 0 && denomValues.length > 0) {
        const fbCount = await this.synagoguesRepo.query(
          `SELECT COUNT(*) FROM synagogues s WHERE s."destinationId" = $1`,
          [destinationId],
        );
        total = parseInt(fbCount[0].count, 10);
        gpsWhere = `s."destinationId" = $3`;
        gpsParams.splice(3); // remove denomination param
        denominationFallback = true;
        gIdx = 4;
      }

      gpsParams.push(offset);
      const localData = await this.synagoguesRepo.query(
        `SELECT s.id, s.name, s.address, s.description, s.phone, s.website, s.denomination, s.location,
                d.city AS "destinationCity",
                ROUND(ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric) AS "distanceMeters"
         FROM synagogues s
         JOIN destinations d ON s."destinationId" = d.id
         WHERE ${gpsWhere}
         ORDER BY s.location::geography <-> ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
         LIMIT 50 OFFSET $${gIdx}`,
        gpsParams,
      );

      // Supplement with nearby synagogues from other destinations when local results are sparse
      if (expandNearby && offset === 0 && total < 30) {
        const supParams: any[] = [searchLng, searchLat, destinationId];
        let supWhere = `s."destinationId" != $3 AND s.location IS NOT NULL
          AND ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) <= 30000`;
        if (denomValues.length > 0 && !denominationFallback) {
          supWhere += ` AND s.denomination = ANY($4)`;
          supParams.push(denomValues);
        }
        const supplement = await this.synagoguesRepo.query(
          `SELECT s.id, s.name, s.address, s.description, s.phone, s.website, s.denomination, s.location,
                  d.city AS "destinationCity",
                  ROUND(ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric) AS "distanceMeters"
           FROM synagogues s
           JOIN destinations d ON s."destinationId" = d.id
           WHERE ${supWhere}
           ORDER BY s.location::geography <-> ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
           LIMIT 50`,
          supParams,
        );
        const localIds = new Set(localData.map((r: any) => r.id));
        const extra = supplement.filter((r: any) => !localIds.has(r.id));
        if (extra.length > 0) {
          const combined = [...localData, ...extra];
          combined.sort((a: any, b: any) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
          const merged = combined.slice(0, 50);
          return { data: merged, total: merged.length, denominationFallback };
        }
      }

      return { data: localData, total, denominationFallback };
    }

    // ── No GPS: findAndCount sorted by name ──────────────
    const { In } = await import('typeorm');
    const where: any = { destination: { id: destinationId } };
    if (denomValues.length > 0) where.denomination = In(denomValues);

    let [data, total] = await this.synagoguesRepo.findAndCount({
      where,
      select: ['id', 'name', 'address', 'description', 'phone', 'website', 'location', 'denomination'],
      order: { name: 'ASC' },
      take: 50,
      skip: offset,
    });

    // Fallback: if denomination filter returned nothing, retry without denomination
    let denominationFallback = false;
    if (total === 0 && denomValues.length > 0) {
      [data, total] = await this.synagoguesRepo.findAndCount({
        where: { destination: { id: destinationId } },
        select: ['id', 'name', 'address', 'description', 'phone', 'website', 'location', 'denomination'],
        order: { name: 'ASC' },
        take: 50,
        skip: offset,
      });
      denominationFallback = true;
    }

    return { data, total, denominationFallback };
  }

  private async resolveSearchOrigin(
    destinationId: number,
    lat?: number,
    lng?: number,
    expandNearby = false,
  ): Promise<{ lat: number; lng: number } | null> {
    if (lat !== undefined && lng !== undefined) {
      return { lat, lng };
    }
    if (!expandNearby) return null;

    const rows = await this.destinationsRepo.query(
      `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM destinations
       WHERE id = $1 AND location IS NOT NULL
       LIMIT 1`,
      [destinationId],
    );
    const row = rows[0];
    if (row?.lat != null && row?.lng != null) {
      return { lat: parseFloat(row.lat), lng: parseFloat(row.lng) };
    }

    const synagogueRows = await this.synagoguesRepo.query(
      `SELECT
         ST_Y(ST_Centroid(ST_Collect(location::geometry))) AS lat,
         ST_X(ST_Centroid(ST_Collect(location::geometry))) AS lng
       FROM synagogues
       WHERE "destinationId" = $1 AND location IS NOT NULL`,
      [destinationId],
    );
    const synagogueOrigin = synagogueRows[0];
    if (synagogueOrigin?.lat == null || synagogueOrigin?.lng == null) return null;
    return { lat: parseFloat(synagogueOrigin.lat), lng: parseFloat(synagogueOrigin.lng) };
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

  async findByParentDestination(
    parentId: number,
    denomination?: string,
    offset = 0,
    lat?: number,
    lng?: number,
  ): Promise<{ data: any[]; total: number }> {
    const denomValues = denomination ? (this.DENOM_MAP[denomination] ?? []) : [];

    if (lat !== undefined && lng !== undefined) {
      const countParams: any[] = [parentId];
      let countWhere = `d.parent_id = $1`;
      const gpsParams: any[] = [lng, lat, parentId];
      let gpsWhere = `d.parent_id = $3`;
      let cIdx = 2;
      let gIdx = 4;

      if (denomValues.length > 0) {
        countWhere += ` AND s.denomination = ANY($${cIdx++})`;
        countParams.push(denomValues);
        gpsWhere  += ` AND s.denomination = ANY($${gIdx++})`;
        gpsParams.push(denomValues);
      }

      const countResult = await this.synagoguesRepo.query(
        `SELECT COUNT(*) FROM synagogues s JOIN destinations d ON s."destinationId" = d.id WHERE ${countWhere}`,
        countParams,
      );
      const total = parseInt(countResult[0].count, 10);

      gpsParams.push(offset);
      const data = await this.synagoguesRepo.query(
        `SELECT s.id, s.name, s.address, s.description, s.phone, s.website, s.denomination,
                d.city AS "destinationCity",
                ROUND(ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric) AS "distanceMeters"
         FROM synagogues s
         JOIN destinations d ON s."destinationId" = d.id
         WHERE ${gpsWhere}
         ORDER BY s.location::geography <-> ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
         LIMIT 50 OFFSET $${gIdx}`,
        gpsParams,
      );
      return { data, total };
    }

    const countParams: any[] = [parentId];
    let countSql = `SELECT COUNT(*) FROM synagogues s JOIN destinations d ON s."destinationId" = d.id WHERE d.parent_id = $1`;
    let sql = `
      SELECT s.id, s.name, s.address, s.description, s.phone, s.website, s.denomination,
             d.city AS "destinationCity"
      FROM synagogues s
      JOIN destinations d ON s."destinationId" = d.id
      WHERE d.parent_id = $1`;
    let idx = 2;

    if (denomValues.length > 0) {
      countSql += ` AND s.denomination = ANY($${idx})`;
      countParams.push(denomValues);
      sql += ` AND s.denomination = ANY($${idx})`;
      idx++;
    }

    const countResult = await this.synagoguesRepo.query(countSql, countParams);
    const total = parseInt(countResult[0].count, 10);

    const dataParams = [...countParams, offset];
    sql += ` ORDER BY d.city ASC, s.name ASC LIMIT 50 OFFSET $${idx}`;
    const data = await this.synagoguesRepo.query(sql, dataParams);
    return { data, total };
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
