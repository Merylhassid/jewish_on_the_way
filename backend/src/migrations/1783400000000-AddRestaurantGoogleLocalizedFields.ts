import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stores localized Google display values separately from both the original
 * restaurant fields and the first generic Google response.
 *
 * These fields let the UI pick the right language without ever overwriting
 * restaurants.name / restaurants.address.
 */
export class AddRestaurantGoogleLocalizedFields1783400000000
  implements MigrationInterface
{
  name = 'AddRestaurantGoogleLocalizedFields1783400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "google_display_name_he" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "google_formatted_address_he" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "google_display_name_en" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "google_formatted_address_en" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "google_formatted_address_en"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "google_display_name_en"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "google_formatted_address_he"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "google_display_name_he"`,
    );
  }
}
