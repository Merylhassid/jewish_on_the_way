import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHostingRequestNeedId1789000000000 implements MigrationInterface {
  name = 'AddHostingRequestNeedId1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hosting_requests"
      ADD COLUMN IF NOT EXISTS "need_id" integer
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_hosting_requests_need'
        ) THEN
          ALTER TABLE "hosting_requests"
          ADD CONSTRAINT "FK_hosting_requests_need"
          FOREIGN KEY ("need_id") REFERENCES "hosting_needs"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hosting_requests_need_id"
      ON "hosting_requests" ("need_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hosting_requests_need_id"`);
    await queryRunner.query(`ALTER TABLE "hosting_requests" DROP CONSTRAINT IF EXISTS "FK_hosting_requests_need"`);
    await queryRunner.query(`ALTER TABLE "hosting_requests" DROP COLUMN IF EXISTS "need_id"`);
  }
}
