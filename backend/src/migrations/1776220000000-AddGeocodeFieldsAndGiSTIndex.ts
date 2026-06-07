import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeocodeFieldsAndGiSTIndex1776220000000 implements MigrationInterface {
  name = 'AddGeocodeFieldsAndGiSTIndex1776220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Store raw coordinates for reference and easy CSV export
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION`);
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION`);

    // Location metadata
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "city" CHARACTER VARYING(128)`);
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "country" CHARACTER VARYING(128)`);
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "phone" CHARACTER VARYING(32)`);

    // Tracks when geocoding ran so we never re-geocode existing rows
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "geocoded_at" TIMESTAMPTZ`);

    // GiST index — makes ST_Distance / ST_DWithin use O(log n) instead of full table scan
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_restaurants_location_gist" ON "restaurants" USING GIST ("location")`,
    );

    // B-tree index on country/city for filter queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_restaurants_country_city" ON "restaurants" ("country", "city")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_restaurants_country_city"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_restaurants_location_gist"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "geocoded_at"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "phone"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "country"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "city"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "lng"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "lat"`);
  }
}
