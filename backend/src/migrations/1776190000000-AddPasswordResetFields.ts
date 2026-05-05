import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetFields1776190000000 implements MigrationInterface {
  name = 'AddPasswordResetFields1776190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add reset_password_token column if it doesn't exist
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_token" character varying`,
    );

    // Add reset_password_expires column if it doesn't exist
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_expires" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove reset_password_expires column
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_expires"`,
    );

    // Remove reset_password_token column
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_token"`,
    );
  }
}
