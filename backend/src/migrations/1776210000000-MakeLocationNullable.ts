import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeLocationNullable1776210000000 implements MigrationInterface {
  name = 'MakeLocationNullable1776210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Allow location to be NULL so restaurants can exist in the DB before geocoding runs.
    // The backfill script (scripts/geocode-existing-restaurants.ts) fills these in.
    await queryRunner.query(
      `ALTER TABLE "restaurants" ALTER COLUMN "location" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only safe to restore NOT NULL after all rows have been geocoded
    await queryRunner.query(
      `ALTER TABLE "restaurants" ALTER COLUMN "location" SET NOT NULL`,
    );
  }
}
