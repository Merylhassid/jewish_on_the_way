import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchFeedbackCreatedAtIndex1793000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_search_feedback_created_at" ON "search_feedback" ("created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_search_feedback_created_at"',
    );
  }
}
