import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitedStatesHierarchy1776185000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "parent_id" integer NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_destinations_parent'
        ) THEN
          ALTER TABLE "destinations"
            ADD CONSTRAINT "FK_destinations_parent"
            FOREIGN KEY ("parent_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    const existingUnitedStates = await queryRunner.query(`
      SELECT id FROM "destinations"
      WHERE "name" = $1 AND "country" = $2 AND "parent_id" IS NULL
      LIMIT 1
    `, ['United States', 'United States']);

    let unitedStatesId = existingUnitedStates[0]?.id;
    if (!unitedStatesId) {
      const result = await queryRunner.query(`
        INSERT INTO "destinations" ("name", "city", "country", "country_code", "description", "location", "created_at")
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), now())
        RETURNING id
      `, [
        'United States',
        'United States',
        'United States',
        'US',
        'Parent destination for United States sub-destinations.',
        -98.5795,
        39.8283,
      ]);
      unitedStatesId = result[0]?.id;
    }

    if (!unitedStatesId) {
      throw new Error('Failed to resolve United States parent destination');
    }

    await queryRunner.query(`
      UPDATE "destinations"
      SET "parent_id" = $1
      WHERE "name" = $2
        AND "country" = $3
        AND ("parent_id" IS NULL OR "parent_id" <> $1)
    `, [unitedStatesId, 'New York', 'United States']);

    const children = [
      { name: 'Miami', city: 'Miami', lat: 25.7617, lng: -80.1918 },
      { name: 'Los Angeles', city: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
      { name: 'Fort Lauderdale', city: 'Fort Lauderdale', lat: 26.1224, lng: -80.1373 },
      { name: 'Orlando', city: 'Orlando', lat: 28.5383, lng: -81.3792 },
      { name: 'Las Vegas', city: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
      { name: 'San Francisco', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
      { name: 'San Diego', city: 'San Diego', lat: 32.7157, lng: -117.1611 },
      { name: 'Chicago', city: 'Chicago', lat: 41.8781, lng: -87.6298 },
      { name: 'Boston', city: 'Boston', lat: 42.3601, lng: -71.0589 },
      { name: 'Washington, D.C.', city: 'Washington, D.C.', lat: 38.9072, lng: -77.0369 },
      { name: 'Atlanta', city: 'Atlanta', lat: 33.7490, lng: -84.3880 },
      { name: 'Dallas', city: 'Dallas', lat: 32.7767, lng: -96.7970 },
      { name: 'Philadelphia', city: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
      { name: 'Seattle', city: 'Seattle', lat: 47.6062, lng: -122.3321 },
    ];

    for (const child of children) {
      const existingChild = await queryRunner.query(`
        SELECT id FROM "destinations"
        WHERE "name" = $1
          AND "country" = $2
          AND "parent_id" = $3
        LIMIT 1
      `, [child.name, 'United States', unitedStatesId]);

      if (existingChild.length > 0) {
        continue;
      }

      await queryRunner.query(`
        INSERT INTO "destinations" ("name", "city", "country", "country_code", "description", "location", "parent_id", "created_at")
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, now())
      `, [
        child.name,
        child.city,
        'United States',
        'US',
        `Sub-destination of United States: ${child.name}`,
        child.lng,
        child.lat,
        unitedStatesId,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const unitedStates = await queryRunner.query(`
      SELECT id FROM "destinations"
      WHERE "name" = $1 AND "country" = $2 AND "parent_id" IS NULL
      LIMIT 1
    `, ['United States', 'United States']);

    const unitedStatesId = unitedStates[0]?.id;
    if (!unitedStatesId) {
      return;
    }

    await queryRunner.query(`
      UPDATE "destinations"
      SET "parent_id" = NULL
      WHERE "name" = $1
        AND "country" = $2
        AND "parent_id" = $3
    `, [
      'New York',
      'United States',
      unitedStatesId,
    ]);

    const childNames = [
      'Miami',
      'Los Angeles',
      'Fort Lauderdale',
      'Orlando',
      'Las Vegas',
      'San Francisco',
      'San Diego',
      'Chicago',
      'Boston',
      'Washington, D.C.',
      'Atlanta',
      'Dallas',
      'Philadelphia',
      'Seattle',
    ];

    await queryRunner.query(`
      DELETE FROM "destinations"
      WHERE "name" = ANY($1)
        AND "country" = $2
        AND "parent_id" = $3
    `, [childNames, 'United States', unitedStatesId]);

    await queryRunner.query(`
      DELETE FROM "destinations"
      WHERE "name" = $1
        AND "country" = $2
        AND "parent_id" IS NULL
    `, ['United States', 'United States']);
  }
}
