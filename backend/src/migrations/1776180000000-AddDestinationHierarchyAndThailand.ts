import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDestinationHierarchyAndThailand1776180000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "parent_id" integer NULL`,
    );
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

    const existingThailand = await queryRunner.query(
      `
      SELECT id FROM "destinations"
      WHERE "name" = $1 AND "country" = $2 AND "parent_id" IS NULL
      LIMIT 1
    `,
      ['Thailand', 'Thailand'],
    );

    let thailandId = existingThailand[0]?.id;
    if (!thailandId) {
      const result = await queryRunner.query(
        `
        INSERT INTO "destinations" ("name", "city", "country", "country_code", "description", "location", "created_at")
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), now())
        RETURNING id
      `,
        [
          'Thailand',
          'Thailand',
          'Thailand',
          'TH',
          'Parent destination for Thailand sub-destinations.',
          100.9925,
          15.87,
        ],
      );
      thailandId = result[0]?.id;
    }

    if (!thailandId) {
      throw new Error('Failed to resolve Thailand parent destination');
    }

    const children = [
      { city: 'Koh Samui', lat: 9.5035, lng: 100.0134 },
      { city: 'Pattaya', lat: 12.9236, lng: 100.8825 },
      { city: 'Koh Phangan', lat: 9.7439, lng: 100.023 },
      { city: 'Phuket', lat: 7.8804, lng: 98.3923 },
      { city: 'Bangkok', lat: 13.7563, lng: 100.5018 },
      { city: 'Pai', lat: 19.358, lng: 98.4367 },
      { city: 'Chiang Mai', lat: 18.7883, lng: 98.9853 },
    ];

    for (const child of children) {
      const existingChild = await queryRunner.query(
        `
        SELECT id FROM "destinations"
        WHERE "name" = $1 AND "country" = $2 AND "parent_id" = $3
        LIMIT 1
      `,
        [child.city, 'Thailand', thailandId],
      );

      if (existingChild.length > 0) {
        continue;
      }

      await queryRunner.query(
        `
        INSERT INTO "destinations" ("name", "city", "country", "country_code", "description", "location", "parent_id", "created_at")
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, now())
      `,
        [
          child.city,
          child.city,
          'Thailand',
          'TH',
          `Sub-destination of Thailand: ${child.city}`,
          child.lng,
          child.lat,
          thailandId,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "destinations" WHERE "country" = $1 AND "parent_id" IS NOT NULL`,
      ['Thailand'],
    );
    await queryRunner.query(
      `DELETE FROM "destinations" WHERE "country" = $1 AND "parent_id" IS NULL`,
      ['Thailand'],
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_destinations_parent') THEN
          ALTER TABLE "destinations" DROP CONSTRAINT "FK_destinations_parent";
        END IF;
      END
      $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "destinations" DROP COLUMN IF EXISTS "parent_id"`,
    );
  }
}
