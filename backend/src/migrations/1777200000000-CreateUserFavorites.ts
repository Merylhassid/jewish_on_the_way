import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUserFavorites1777200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'user_favorites',
      columns: [
        { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'user_id', type: 'integer', isNullable: false },
        { name: 'entity_type', type: 'varchar', length: '20', isNullable: false },
        { name: 'entity_id', type: 'integer', isNullable: false },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);

    await queryRunner.createIndex('user_favorites', new TableIndex({
      name: 'IDX_user_favorites_user',
      columnNames: ['user_id', 'entity_type'],
    }));
    await queryRunner.createIndex('user_favorites', new TableIndex({
      name: 'IDX_user_favorites_unique',
      columnNames: ['user_id', 'entity_type', 'entity_id'],
      isUnique: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_favorites', true);
  }
}
