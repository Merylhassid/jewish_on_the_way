import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialLoginFields1777400000000 implements MigrationInterface {
  name = 'AddSocialLoginFields1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "google_id" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "apple_id" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "facebook_id" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_google_id" UNIQUE ("google_id")`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_apple_id" UNIQUE ("apple_id")`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_facebook_id" UNIQUE ("facebook_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_facebook_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_apple_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_google_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "facebook_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "apple_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "google_id"`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
  }
}
