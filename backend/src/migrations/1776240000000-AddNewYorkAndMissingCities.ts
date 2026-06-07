import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewYorkAndMissingCities1776240000000 implements MigrationInterface {
  name = 'AddNewYorkAndMissingCities1776240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── New York (USA) ────────────────────────────────────────────────────────
    // The previous US migration only tried to UPDATE New York (if it existed),
    // but it was never inserted. We insert it here if still missing.
    const usParent = await queryRunner.query(
      `SELECT id FROM "destinations" WHERE "name" = 'United States' AND "parent_id" IS NULL LIMIT 1`,
    );
    const usId = usParent[0]?.id;

    if (usId) {
      const nyExists = await queryRunner.query(
        `SELECT id FROM "destinations" WHERE "name" = 'New York' AND "country" = 'United States' LIMIT 1`,
      );
      if (!nyExists.length) {
        await queryRunner.query(
          `INSERT INTO "destinations" ("name","city","country","country_code","description","location","parent_id","created_at")
           VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326),$8,now())`,
          ['New York', 'New York', 'United States', 'US',
           'Sub-destination of United States: New York', -74.0060, 40.7128, usId],
        );
      }
    }

    // ── Thailand city name alignment ──────────────────────────────────────────
    // Migration 1776180000000 inserted "Koh Samui". Rename to "Ko Samui" to match
    // the user-facing name consistently.
    await queryRunner.query(
      `UPDATE "destinations"
       SET "name" = 'Ko Samui', "city" = 'Ko Samui'
       WHERE "name" = 'Koh Samui' AND "country" = 'Thailand'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "destinations" WHERE "name" = 'New York' AND "country" = 'United States'`,
    );
    await queryRunner.query(
      `UPDATE "destinations"
       SET "name" = 'Koh Samui', "city" = 'Koh Samui'
       WHERE "name" = 'Ko Samui' AND "country" = 'Thailand'`,
    );
  }
}
