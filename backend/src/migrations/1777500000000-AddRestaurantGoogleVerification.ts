import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds shadow Google-Places fields + verification/photo metadata to restaurants.
 * Google data is stored alongside existing fields (not overwriting) so the
 * enrichment pipeline can gate updates by confidence and keep an audit trail.
 * Existing columns already present and NOT re-added:
 *   google_place_id, phone, rating, lat, lng, location, opening_hours.
 */
export class AddRestaurantGoogleVerification1777500000000
  implements MigrationInterface
{
  name = 'AddRestaurantGoogleVerification1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Shadow Google fields (mirror of what Google returned) ──
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_display_name" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_formatted_address" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_lat" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_lng" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_business_status" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_maps_uri" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_rating_count" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_synced_at" TIMESTAMP WITH TIME ZONE`,
    );

    // ── Verification / match metadata ──
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "verification_status" character varying(16) NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "verification_confidence" numeric(4,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "verification_reason" text`,
    );

    // ── Photo metadata ──
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "photo_url" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "photo_attribution" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "photo_source" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "photo_fetched_at" TIMESTAMP WITH TIME ZONE`,
    );

    // Index to drive resumable batches (skip already-synced rows quickly)
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurants_verification_status" ON "restaurants" ("verification_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_restaurants_verification_status"`,
    );
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "photo_fetched_at"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "photo_source"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "photo_attribution"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "photo_url"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "verification_reason"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "verification_confidence"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "verification_status"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_synced_at"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_rating_count"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_maps_uri"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_business_status"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_lng"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_lat"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_formatted_address"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_display_name"`);
  }
}
