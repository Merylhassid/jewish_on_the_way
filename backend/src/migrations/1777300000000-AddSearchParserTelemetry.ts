import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSearchParserTelemetry1777300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('search_feedback', [
      new TableColumn({
        name: 'parsed_json',
        type: 'jsonb',
        isNullable: true,
      }),
      new TableColumn({
        name: 'parser_version',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'resolved_destination_id',
        type: 'integer',
        isNullable: true,
      }),
      new TableColumn({
        name: 'model_name',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'latency_ms',
        type: 'integer',
        isNullable: true,
      }),
      new TableColumn({
        name: 'source',
        type: 'varchar',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('search_feedback', 'source');
    await queryRunner.dropColumn('search_feedback', 'latency_ms');
    await queryRunner.dropColumn('search_feedback', 'model_name');
    await queryRunner.dropColumn('search_feedback', 'resolved_destination_id');
    await queryRunner.dropColumn('search_feedback', 'parser_version');
    await queryRunner.dropColumn('search_feedback', 'parsed_json');
  }
}
