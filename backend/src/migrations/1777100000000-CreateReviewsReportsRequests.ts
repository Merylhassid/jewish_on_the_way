import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateReviewsReportsRequests1777100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {

    // ── place_reviews ──────────────────────────────────────────────────────────
    await queryRunner.createTable(new Table({
      name: 'place_reviews',
      columns: [
        { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'user_id', type: 'integer', isNullable: false },
        { name: 'entity_type', type: 'varchar', length: '20', isNullable: false },  // 'restaurant' | 'synagogue'
        { name: 'entity_id', type: 'integer', isNullable: false },
        { name: 'stars', type: 'smallint', isNullable: false },
        { name: 'comment', type: 'text', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
        { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);

    await queryRunner.createIndex('place_reviews', new TableIndex({
      name: 'IDX_place_reviews_entity',
      columnNames: ['entity_type', 'entity_id'],
    }));
    await queryRunner.createIndex('place_reviews', new TableIndex({
      name: 'IDX_place_reviews_user_entity',
      columnNames: ['user_id', 'entity_type', 'entity_id'],
      isUnique: true,
    }));

    // ── place_reports ──────────────────────────────────────────────────────────
    await queryRunner.createTable(new Table({
      name: 'place_reports',
      columns: [
        { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'user_id', type: 'integer', isNullable: false },
        { name: 'entity_type', type: 'varchar', length: '20', isNullable: false },
        { name: 'entity_id', type: 'integer', isNullable: false },
        { name: 'report_type', type: 'varchar', length: '50', isNullable: false },
        { name: 'description', type: 'text', isNullable: true },
        { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
        { name: 'admin_note', type: 'text', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);

    await queryRunner.createIndex('place_reports', new TableIndex({
      name: 'IDX_place_reports_entity',
      columnNames: ['entity_type', 'entity_id'],
    }));
    await queryRunner.createIndex('place_reports', new TableIndex({
      name: 'IDX_place_reports_status',
      columnNames: ['status'],
    }));

    // ── place_requests ─────────────────────────────────────────────────────────
    await queryRunner.createTable(new Table({
      name: 'place_requests',
      columns: [
        { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'user_id', type: 'integer', isNullable: false },
        { name: 'entity_type', type: 'varchar', length: '20', isNullable: false },
        { name: 'destination_id', type: 'integer', isNullable: false },
        { name: 'name', type: 'varchar', length: '255', isNullable: false },
        { name: 'address', type: 'text', isNullable: true },
        { name: 'phone', type: 'varchar', length: '64', isNullable: true },
        { name: 'website_url', type: 'varchar', length: '512', isNullable: true },
        { name: 'notes', type: 'text', isNullable: true },
        { name: 'kashrut_level', type: 'varchar', length: '32', isNullable: true },
        { name: 'restaurant_type', type: 'varchar', length: '32', isNullable: true },
        { name: 'nusach', type: 'varchar', length: '64', isNullable: true },
        { name: 'denomination', type: 'varchar', length: '64', isNullable: true },
        { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
        { name: 'admin_note', type: 'text', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);

    await queryRunner.createIndex('place_requests', new TableIndex({
      name: 'IDX_place_requests_status',
      columnNames: ['status'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('place_requests', true);
    await queryRunner.dropTable('place_reports', true);
    await queryRunner.dropTable('place_reviews', true);
  }
}
