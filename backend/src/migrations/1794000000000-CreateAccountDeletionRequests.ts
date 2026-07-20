import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountDeletionRequests1794000000000
  implements MigrationInterface
{
  name = 'CreateAccountDeletionRequests1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_deletion_requests" (
        "id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_deletion_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_account_deletion_requests_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_account_deletion_requests_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_account_deletion_requests_user_id"
      ON "account_deletion_requests" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_account_deletion_requests_expires_at"
      ON "account_deletion_requests" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS "account_deletion_requests"',
    );
  }
}
