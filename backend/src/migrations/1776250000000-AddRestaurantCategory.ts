import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantCategory1776250000000 implements MigrationInterface {
  name = 'AddRestaurantCategory1776250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "category" VARCHAR(128) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "category"`,
    );
  }
}
