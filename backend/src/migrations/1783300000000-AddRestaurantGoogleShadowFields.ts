import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the remaining Google-Places shadow columns needed to store the verified
 * Google layer WITHOUT touching any original field. These mirror Google data in
 * clearly google_*-namespaced columns so the mobile/UI-facing originals
 * (name, address, phone, rating, opening_hours, photo_*) are never overwritten.
 *
 * Already present (added by 1777500000000) and NOT re-added:
 *   google_place_id, google_display_name (=google_name), google_formatted_address
 *   (=google_address), google_lat, google_lng, google_maps_uri, google_rating_count,
 *   google_business_status, google_synced_at, verification_status (=google_sync_status).
 *
 * This migration only ADDS columns; it drops/alters nothing. Fully reversible.
 */
export class AddRestaurantGoogleShadowFields1783300000000
  implements MigrationInterface
{
  name = 'AddRestaurantGoogleShadowFields1783300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_rating" numeric(2,1)`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_phone" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_opening_hours" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_photo_name" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_photo_attribution" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_primary_type" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "google_types" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_types"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_primary_type"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_photo_attribution"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_photo_name"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_opening_hours"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_phone"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "google_rating"`);
  }
}
