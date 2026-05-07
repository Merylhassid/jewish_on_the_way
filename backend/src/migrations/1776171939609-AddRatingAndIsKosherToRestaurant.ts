import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRatingAndIsKosherToRestaurant1776171939609 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE restaurants
            ADD COLUMN rating DECIMAL(2,1) NULL,
            ADD COLUMN is_kosher BOOLEAN NOT NULL DEFAULT FALSE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE restaurants
            DROP COLUMN rating,
            DROP COLUMN is_kosher
        `);
  }
}
