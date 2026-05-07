import { MigrationInterface, QueryRunner } from 'typeorm';

export class IncreasePhoneLength1776200000000 implements MigrationInterface {
  name = 'IncreasePhoneLength1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Increase phone column length from varchar(50) to varchar(255)
    await queryRunner.query(`ALTER TABLE "synagogues" ALTER COLUMN "phone" TYPE varchar(255);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert phone column length back to varchar(50)
    await queryRunner.query(`ALTER TABLE "synagogues" ALTER COLUMN "phone" TYPE varchar(50);`);
  }
}
