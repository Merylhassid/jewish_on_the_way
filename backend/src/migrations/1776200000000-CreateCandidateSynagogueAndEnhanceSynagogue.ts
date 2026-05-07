import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableColumn,
} from 'typeorm';

export class CreateCandidateSynagogueAndEnhanceSynagogue1776200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Drop incomplete candidate_synagogues table if it exists (from failed previous run)
    if (await queryRunner.hasTable('candidate_synagogues')) {
      await queryRunner.dropTable('candidate_synagogues', true);
    }

    // Step 2: Create candidate_synagogues table (fresh)
    await queryRunner.createTable(
      new Table({
        name: 'candidate_synagogues',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'normalized_name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'location',
            type: 'geography(Point, 4326)',
            isNullable: false,
          },
          {
            name: 'destination_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'website',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'opening_hours',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'addr_street',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'addr_housenumber',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'addr_postcode',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'addr_city',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'wikidata',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'wikipedia',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'denomination',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'operator',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'source',
            type: 'varchar',
            default: "'osm'",
            isNullable: false,
          },
          {
            name: 'source_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'raw_osm',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'source_confidence',
            type: 'numeric',
            precision: 3,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'validation_reasons',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            enum: ['pending', 'approved', 'rejected'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'approved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejected_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['destination_id'],
            referencedTableName: 'destinations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      false, // Don't use ifNotExists since we just dropped it
    );

    // Step 3: Add indexes for candidate_synagogues
    await queryRunner.createIndex(
      'candidate_synagogues',
      new TableIndex({
        name: 'idx_candidate_synagogues_osm_id_destination',
        columnNames: ['source_id', 'destination_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'candidate_synagogues',
      new TableIndex({
        name: 'idx_candidate_synagogues_wikidata',
        columnNames: ['wikidata'],
      }),
    );

    await queryRunner.createIndex(
      'candidate_synagogues',
      new TableIndex({
        name: 'idx_candidate_synagogues_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'candidate_synagogues',
      new TableIndex({
        name: 'idx_candidate_synagogues_destination_status',
        columnNames: ['destination_id', 'status'],
      }),
    );

    // Step 2: Add new columns to synagogues table
    const synagogueTable = await queryRunner.getTable('synagogues');

    if (!synagogueTable) {
      throw new Error('Synagogues table not found');
    }

    // Add enriched fields if they don't exist
    if (!synagogueTable.findColumnByName('normalized_name')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'normalized_name',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('website')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'website',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('phone')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'phone',
          type: 'varchar',
          length: '50',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('opening_hours')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'opening_hours',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('addr_street')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'addr_street',
          type: 'varchar',
          length: '200',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('addr_housenumber')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'addr_housenumber',
          type: 'varchar',
          length: '50',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('addr_postcode')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'addr_postcode',
          type: 'varchar',
          length: '50',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('addr_city')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'addr_city',
          type: 'varchar',
          length: '200',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('wikidata')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'wikidata',
          type: 'varchar',
          length: '50',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('wikipedia')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'wikipedia',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('denomination')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'denomination',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('operator')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'operator',
          type: 'varchar',
          length: '200',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('source')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'source',
          type: 'varchar',
          default: "'osm'",
          isNullable: false,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('source_confidence')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'source_confidence',
          type: 'numeric',
          precision: 3,
          scale: 2,
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('raw_osm')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'raw_osm',
          type: 'jsonb',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('manually_verified')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'manually_verified',
          type: 'boolean',
          default: false,
          isNullable: false,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('verification_source')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'verification_source',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('verification_notes')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'verification_notes',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    if (!synagogueTable.findColumnByName('updated_at')) {
      await queryRunner.addColumn(
        'synagogues',
        new TableColumn({
          name: 'updated_at',
          type: 'timestamp',
          default: 'CURRENT_TIMESTAMP',
          isNullable: true,
        }),
      );
    }

    // Add indexes on synagogues table
    await queryRunner.createIndex(
      'synagogues',
      new TableIndex({
        name: 'idx_synagogues_wikidata',
        columnNames: ['wikidata'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop candidate_synagogues table
    await queryRunner.dropTable('candidate_synagogues', true);

    // Remove columns from synagogues table
    const synagogueTable = await queryRunner.getTable('synagogues');

    if (!synagogueTable) {
      throw new Error('Synagogues table not found during rollback');
    }

    const columnsToRemove = [
      'normalized_name',
      'website',
      'phone',
      'opening_hours',
      'addr_street',
      'addr_housenumber',
      'addr_postcode',
      'addr_city',
      'wikidata',
      'wikipedia',
      'denomination',
      'operator',
      'source',
      'source_confidence',
      'raw_osm',
      'manually_verified',
      'verification_source',
      'verification_notes',
      'updated_at',
    ];

    for (const columnName of columnsToRemove) {
      const column = synagogueTable.findColumnByName(columnName);
      if (column) {
        await queryRunner.dropColumn('synagogues', column);
      }
    }

    // Drop indexes
    await queryRunner.dropIndex('synagogues', 'idx_synagogues_wikidata');
    await queryRunner.dropIndex('synagogues', 'idx_synagogues_destination');
  }
}
