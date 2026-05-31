import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostgisLocationGiSTIndexes1777001000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_destinations_location_gist" ON "destinations" USING GIST ("location")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_restaurants_location_gist" ON "restaurants" USING GIST ("location")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_synagogues_location_gist" ON "synagogues" USING GIST ("location")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_candidate_synagogues_location_gist" ON "candidate_synagogues" USING GIST ("location")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_candidate_synagogues_location_gist"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_synagogues_location_gist"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_restaurants_location_gist"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_destinations_location_gist"`,
    );
  }
}