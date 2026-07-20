import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserReportsAndDisabled1791000000000 implements MigrationInterface {
  name = 'CreateUserReportsAndDisabled1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Separate from the pre-existing `isActive` (email verification / self-delete)
    // flag — an admin-disabled account must not be silently re-enabled by the
    // user re-verifying their email.
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_disabled" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_reports" (
        "id" SERIAL NOT NULL,
        "reporter_id" integer NOT NULL,
        "reported_user_id" integer NOT NULL,
        "context" character varying(20) NOT NULL,
        "entity_id" integer NOT NULL,
        "reason" text,
        "status" character varying(20) NOT NULL DEFAULT 'open',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_reports_reported" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_reports_status"
      ON "user_reports" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_reports_reported_user"
      ON "user_reports" ("reported_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_reports_reported_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_reports_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_reports"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_disabled"`);
  }
}
