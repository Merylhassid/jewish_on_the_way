import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSynagogueDescription1776201000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const synagogueTable = await queryRunner.getTable('synagogues');

    if (!synagogueTable) {
      throw new Error('Synagogues table not found during migration');
    }

    if (!synagogueTable.findColumnByName('description')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'description',
          type: 'text',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const synagogueTable = await queryRunner.getTable('synagogues');

    if (!synagogueTable) {
      throw new Error('Synagogues table not found during rollback');
    }

    const descriptionColumn = synagogueTable.findColumnByName('description');
    if (descriptionColumn) {
      await queryRunner.dropColumn('synagogues', descriptionColumn);
    }
  }
}