import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHostingType1790000000000 implements MigrationInterface {
  name = 'AddHostingType1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // hosting_offers: new default is 'both'; existing rows (created before
    // meals support existed) are backfilled to 'stay' — they were always
    // lodging-only offers.
    await queryRunner.query(`
      ALTER TABLE "hosting_offers"
      ADD COLUMN IF NOT EXISTS "hosting_type" varchar(10) NOT NULL DEFAULT 'both'
    `);
    await queryRunner.query(`
      UPDATE "hosting_offers" SET "hosting_type" = 'stay'
    `);

    await queryRunner.query(`
      ALTER TABLE "hosting_needs"
      ADD COLUMN IF NOT EXISTS "hosting_type" varchar(10) NOT NULL DEFAULT 'stay'
    `);

    await queryRunner.query(`
      ALTER TABLE "hosting_requests"
      ADD COLUMN IF NOT EXISTS "hosting_type" varchar(10) NOT NULL DEFAULT 'stay'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hosting_requests" DROP COLUMN IF EXISTS "hosting_type"`);
    await queryRunner.query(`ALTER TABLE "hosting_needs" DROP COLUMN IF EXISTS "hosting_type"`);
    await queryRunner.query(`ALTER TABLE "hosting_offers" DROP COLUMN IF EXISTS "hosting_type"`);
  }
}
